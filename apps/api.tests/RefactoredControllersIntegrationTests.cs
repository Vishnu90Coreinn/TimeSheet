using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Api.Dtos;
using Xunit;

namespace TimeSheet.Api.Tests;

public class RefactoredControllersIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly CustomWebApplicationFactory _factory;

    public RefactoredControllersIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Privacy_RequestExport_ReturnsExistingPendingRequest()
    {
        var username = $"privacy.user.{Guid.NewGuid():N}"[..20];
        var user = await EnsureUserAsync(username, "employee");
        Guid pendingId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            var pending = new DataExportRequest
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Status = "Pending",
                RequestedAt = DateTime.UtcNow
            };
            db.DataExportRequests.Add(pending);
            await db.SaveChangesAsync();
            pendingId = pending.Id;
        }

        using var client = await CreateAuthedClientAsync(username, "employee123");

        var first = await client.PostAsync("/api/v1/privacy/export-request", null);
        var list = await client.GetAsync("/api/v1/privacy/export-requests");

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);

        var firstPayload = await first.Content.ReadFromJsonAsync<ExportRequestResponse>(JsonOptions);
        var listPayload = await list.Content.ReadFromJsonAsync<List<ExportRequestResponse>>(JsonOptions);

        Assert.NotNull(firstPayload);
        Assert.Equal(pendingId, firstPayload!.Id);
        Assert.Equal("Pending", firstPayload.Status);
        Assert.Contains(listPayload!, x => x.Id == firstPayload.Id);
    }

    [Fact]
    public async Task Profile_GetAndUpdateNotificationPreferences_Works()
    {
        var username = $"profile.user.{Guid.NewGuid():N}"[..20];
        var user = await EnsureUserAsync(username, "employee");
        using var client = await CreateAuthedClientAsync(username, "employee123");

        var getProfile = await client.GetAsync("/api/v1/profile");
        Assert.Equal(HttpStatusCode.OK, getProfile.StatusCode);

        var profile = await getProfile.Content.ReadFromJsonAsync<MyProfileResponse>(JsonOptions);
        Assert.NotNull(profile);
        Assert.Equal(user.Username, profile!.Username);

        var updatePrefs = await client.PutAsJsonAsync("/api/v1/profile/notification-preferences",
            new UpdateNotificationPreferencesRequest(false, true, false, true, true, true));
        Assert.Equal(HttpStatusCode.NoContent, updatePrefs.StatusCode);

        var getPrefs = await client.GetAsync("/api/v1/profile/notification-preferences");
        Assert.Equal(HttpStatusCode.OK, getPrefs.StatusCode);

        var prefs = await getPrefs.Content.ReadFromJsonAsync<NotificationPreferencesResponse>(JsonOptions);
        Assert.NotNull(prefs);
        Assert.False(prefs!.OnApproval);
        Assert.True(prefs.EmailEnabled);
    }

    [Fact]
    public async Task ProjectBudget_HealthAndSummary_ReturnExpectedMetrics()
    {
        var user = await EnsureUserAsync($"budget.user.{Guid.NewGuid():N}"[..20], "employee");
        var workDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-7);
        Guid projectId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            var category = await db.TaskCategories.FirstAsync();

            var project = new Project
            {
                Id = Guid.NewGuid(),
                Name = $"Budget Project {Guid.NewGuid():N}"[..20],
                Code = $"BP-{Guid.NewGuid():N}"[..10],
                BudgetedHours = 10,
                IsActive = true,
                IsArchived = false
            };

            var timesheet = new Timesheet
            {
                UserId = user.Id,
                WorkDate = workDate,
                Status = TimesheetStatus.Approved
            };

            db.Projects.Add(project);
            db.Timesheets.Add(timesheet);
            db.TimesheetEntries.AddRange(
                new TimesheetEntry
                {
                    Id = Guid.NewGuid(),
                    TimesheetId = timesheet.Id,
                    ProjectId = project.Id,
                    TaskCategoryId = category.Id,
                    Minutes = 240,
                    Notes = "Budget work 1"
                },
                new TimesheetEntry
                {
                    Id = Guid.NewGuid(),
                    TimesheetId = timesheet.Id,
                    ProjectId = project.Id,
                    TaskCategoryId = category.Id,
                    Minutes = 180,
                    Notes = "Budget work 2"
                });

            await db.SaveChangesAsync();
            projectId = project.Id;
        }

        using var client = await CreateAdminClientAsync();

        var healthResponse = await client.GetAsync("/api/v1/projects/budget-health");
        Assert.Equal(HttpStatusCode.OK, healthResponse.StatusCode);
        var health = await healthResponse.Content.ReadFromJsonAsync<List<ProjectBudgetHealthItem>>(JsonOptions);
        var item = Assert.Single(health!.Where(x => x.Id == projectId));
        Assert.Equal(7.0, item.LoggedHours);
        Assert.Equal("on-track", item.Status);

        var summaryResponse = await client.GetAsync($"/api/v1/projects/{projectId}/budget-summary");
        Assert.Equal(HttpStatusCode.OK, summaryResponse.StatusCode);
        var summary = await summaryResponse.Content.ReadFromJsonAsync<ProjectBudgetSummaryResponse>(JsonOptions);
        Assert.NotNull(summary);
        Assert.Equal(7.0, summary!.LoggedHours);
        Assert.Equal(3.0, summary.RemainingHours);
        Assert.Equal(8, summary.WeeklyBreakdown.Count);
    }

    [Fact]
    public async Task Push_SubscribeAndUnsubscribe_PersistsSubscription()
    {
        var username = $"push.user.{Guid.NewGuid():N}"[..20];
        var user = await EnsureUserAsync(username, "employee");
        using var client = await CreateAuthedClientAsync(username, "employee123");
        var endpoint = $"https://push.example/{Guid.NewGuid():N}";

        var subscribe = await client.PostAsJsonAsync("/api/v1/push/subscribe", new
        {
            endpoint,
            keys = new { p256dh = "p256dh-key", auth = "auth-key" }
        });

        Assert.Equal(HttpStatusCode.OK, subscribe.StatusCode);

        using (var verifyScope = _factory.Services.CreateScope())
        {
            var db = verifyScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            var sub = await db.PushSubscriptions.SingleOrDefaultAsync(x => x.Endpoint == endpoint);
            Assert.NotNull(sub);
            Assert.Equal(user.Id, sub!.UserId);
        }

        var unsubscribe = await client.PostAsJsonAsync("/api/v1/push/unsubscribe", new { endpoint });
        Assert.Equal(HttpStatusCode.OK, unsubscribe.StatusCode);

        using var finalScope = _factory.Services.CreateScope();
        var finalDb = finalScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        Assert.False(await finalDb.PushSubscriptions.AnyAsync(x => x.Endpoint == endpoint));
    }

    [Fact]
    public async Task Timers_StartStopAndHistory_Work()
    {
        var username = $"timer.user.{Guid.NewGuid():N}"[..20];
        var user = await EnsureUserAsync(username, "employee");
        Guid projectId;
        Guid categoryId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            var project = new Project
            {
                Id = Guid.NewGuid(),
                Name = $"Timer Project {Guid.NewGuid():N}"[..19],
                Code = $"TP-{Guid.NewGuid():N}"[..10],
                IsActive = true,
                IsArchived = false
            };
            var category = await db.TaskCategories.FirstAsync();
            db.Projects.Add(project);
            db.ProjectMembers.Add(new ProjectMember { ProjectId = project.Id, UserId = user.Id });
            await db.SaveChangesAsync();
            projectId = project.Id;
            categoryId = category.Id;
        }

        using var client = await CreateAuthedClientAsync(username, "employee123");

        var start = await client.PostAsJsonAsync("/api/v1/timers/start", new StartTimerRequest(projectId, categoryId, "Timer test"));
        Assert.Equal(HttpStatusCode.OK, start.StatusCode);

        var stop = await client.PostAsync("/api/v1/timers/stop", null);
        Assert.Equal(HttpStatusCode.OK, stop.StatusCode);

        var history = await client.GetAsync($"/api/v1/timers/history?date={DateOnly.FromDateTime(DateTime.UtcNow):yyyy-MM-dd}");
        Assert.Equal(HttpStatusCode.OK, history.StatusCode);
        var sessions = await history.Content.ReadFromJsonAsync<List<TimerSessionResponse>>(JsonOptions);
        Assert.NotNull(sessions);
        Assert.Contains(sessions!, x => x.ProjectId == projectId && x.DurationMinutes.HasValue);
    }

    [Fact]
    public async Task TimesheetExport_UsersAndCsvExport_Work()
    {
        var username = $"export.user.{Guid.NewGuid():N}"[..20];
        var user = await EnsureUserAsync(username, "employee");
        Guid projectId;
        Guid categoryId;
        var workDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            var project = new Project
            {
                Id = Guid.NewGuid(),
                Name = $"Export Project {Guid.NewGuid():N}"[..18],
                Code = $"EP-{Guid.NewGuid():N}"[..10],
                IsActive = true,
                IsArchived = false
            };
            var category = await db.TaskCategories.FirstAsync();
            var timesheet = new Timesheet
            {
                UserId = user.Id,
                WorkDate = workDate,
                Status = TimesheetStatus.Approved
            };

            db.Projects.Add(project);
            db.ProjectMembers.Add(new ProjectMember { ProjectId = project.Id, UserId = user.Id });
            db.Timesheets.Add(timesheet);
            db.TimesheetEntries.Add(new TimesheetEntry
            {
                Id = Guid.NewGuid(),
                TimesheetId = timesheet.Id,
                ProjectId = project.Id,
                TaskCategoryId = category.Id,
                Minutes = 90,
                Notes = "Exported entry"
            });

            await db.SaveChangesAsync();
            projectId = project.Id;
            categoryId = category.Id;
        }

        using var client = await CreateAuthedClientAsync(username, "employee123");

        var usersResponse = await client.GetAsync("/api/v1/timesheets/export/users");
        Assert.Equal(HttpStatusCode.OK, usersResponse.StatusCode);
        var users = await usersResponse.Content.ReadFromJsonAsync<List<TimesheetExportUserDto>>(JsonOptions);
        Assert.NotNull(users);
        Assert.Single(users!);
        Assert.Equal(username, users[0].Username);

        var exportResponse = await client.GetAsync($"/api/v1/timesheets/export?fromDate={workDate:yyyy-MM-dd}&toDate={workDate:yyyy-MM-dd}&format=csv");
        Assert.Equal(HttpStatusCode.OK, exportResponse.StatusCode);
        Assert.Equal("text/csv", exportResponse.Content.Headers.ContentType?.MediaType);
        var csv = await exportResponse.Content.ReadAsStringAsync();
        Assert.Contains("Exported entry", csv);
        Assert.Contains("Date,Employee,Status,Project,Task Category,Minutes,Hours,Notes", csv);
    }

    [Fact]
    public async Task TimesheetTemplates_CreateListAndApply_Work()
    {
        var username = $"template.user.{Guid.NewGuid():N}"[..20];
        var user = await EnsureUserAsync(username, "employee");
        Guid projectId;
        Guid categoryId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            var project = new Project
            {
                Id = Guid.NewGuid(),
                Name = $"Template Project {Guid.NewGuid():N}"[..16],
                Code = $"TT-{Guid.NewGuid():N}"[..10],
                IsActive = true,
                IsArchived = false
            };
            var category = await db.TaskCategories.FirstAsync();
            db.Projects.Add(project);
            db.ProjectMembers.Add(new ProjectMember { ProjectId = project.Id, UserId = user.Id });
            await db.SaveChangesAsync();
            projectId = project.Id;
            categoryId = category.Id;
        }

        using var client = await CreateAuthedClientAsync(username, "employee123");
        var create = await client.PostAsJsonAsync("/api/v1/timesheets/templates",
            new CreateTemplateRequest("My Template", [new TemplateEntryData(projectId, categoryId, 60, "From template")]));
        Assert.Equal(HttpStatusCode.OK, create.StatusCode);
        var template = await create.Content.ReadFromJsonAsync<TemplateResponse>(JsonOptions);
        Assert.NotNull(template);

        var list = await client.GetAsync("/api/v1/timesheets/templates");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var templates = await list.Content.ReadFromJsonAsync<List<TemplateResponse>>(JsonOptions);
        Assert.Contains(templates!, x => x.Id == template!.Id);

        var applyDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var apply = await client.PostAsJsonAsync($"/api/v1/timesheets/templates/{template!.Id}/apply", new ApplyTemplateRequest(applyDate));
        Assert.Equal(HttpStatusCode.OK, apply.StatusCode);
        var applyResult = await apply.Content.ReadFromJsonAsync<ApplyTemplateResult>(JsonOptions);
        Assert.NotNull(applyResult);
        Assert.Equal(1, applyResult!.EntriesCreated);
    }

    [Fact]
    public async Task Users_CreateUpdateSetManagerAndReportees_Work()
    {
        using var adminClient = await CreateAdminClientAsync();
        var managerSuffix = Guid.NewGuid().ToString("N")[..8];
        var employeeSuffix = Guid.NewGuid().ToString("N")[..8];

        var createManager = await adminClient.PostAsJsonAsync("/api/v1/users", new UpsertUserRequest(
            $"mgr.{managerSuffix}",
            $"mgr.{managerSuffix}@timesheet.local",
            $"MGR-{managerSuffix}",
            "manager123",
            "manager",
            true,
            null,
            null,
            null,
            null));
        Assert.Equal(HttpStatusCode.Created, createManager.StatusCode);
        var manager = await createManager.Content.ReadFromJsonAsync<UserResponse>(JsonOptions);
        Assert.NotNull(manager);

        var createEmployee = await adminClient.PostAsJsonAsync("/api/v1/users", new UpsertUserRequest(
            $"emp.{employeeSuffix}",
            $"emp.{employeeSuffix}@timesheet.local",
            $"EMP-{employeeSuffix}",
            "employee123",
            "employee",
            true,
            null,
            null,
            null,
            null));
        Assert.Equal(HttpStatusCode.Created, createEmployee.StatusCode);
        var employee = await createEmployee.Content.ReadFromJsonAsync<UserResponse>(JsonOptions);
        Assert.NotNull(employee);

        var update = await adminClient.PutAsJsonAsync($"/api/v1/users/{employee!.Id}", new UpdateUserRequest(
            employee.Username,
            $"updated.{employee.Email}",
            employee.EmployeeId,
            employee.Role,
            employee.IsActive,
            employee.DepartmentId,
            employee.WorkPolicyId,
            employee.LeavePolicyId,
            employee.ManagerId));
        Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);

        var setManager = await adminClient.PostAsJsonAsync($"/api/v1/users/{employee.Id}/manager", new SetManagerRequest(manager!.Id));
        Assert.Equal(HttpStatusCode.NoContent, setManager.StatusCode);

        var reportees = await adminClient.GetAsync($"/api/v1/users/{manager.Id}/reportees");
        Assert.Equal(HttpStatusCode.OK, reportees.StatusCode);
        var reporteeList = await reportees.Content.ReadFromJsonAsync<List<UserResponse>>(JsonOptions);
        Assert.Contains(reporteeList!, x => x.Id == employee.Id);

        var assignRole = await adminClient.PostAsJsonAsync($"/api/v1/users/{employee.Id}/roles", new AssignRoleRequest("manager"));
        Assert.Equal(HttpStatusCode.NoContent, assignRole.StatusCode);

        var getUser = await adminClient.GetAsync($"/api/v1/users/{employee.Id}");
        Assert.Equal(HttpStatusCode.OK, getUser.StatusCode);
        var userPayload = await getUser.Content.ReadFromJsonAsync<UserResponse>(JsonOptions);
        Assert.Equal("manager", userPayload!.Role);
        Assert.Equal(manager.Id, userPayload.ManagerId);
    }

    [Fact]
    public async Task Projects_AdminCrudAndMembers_Work()
    {
        using var adminClient = await CreateAdminClientAsync();
        var member = await EnsureUserAsync($"project.member.{Guid.NewGuid():N}"[..20], "employee");

        var create = await adminClient.PostAsJsonAsync("/api/v1/projects", new UpsertProjectRequest("Delivery Revamp", $"PRJ-{Guid.NewGuid():N}"[..10], true, 120));
        Assert.Equal(HttpStatusCode.OK, create.StatusCode);
        var project = await create.Content.ReadFromJsonAsync<ProjectResponse>(JsonOptions);
        Assert.NotNull(project);

        var get = await adminClient.GetAsync($"/api/v1/projects/{project!.Id}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);

        var update = await adminClient.PutAsJsonAsync($"/api/v1/projects/{project.Id}", new UpsertProjectRequest("Delivery Revamp 2", project.Code, true, 140));
        Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);

        var setMembers = await adminClient.PutAsJsonAsync($"/api/v1/projects/{project.Id}/members", new AssignProjectMembersRequest([member.Id]));
        Assert.Equal(HttpStatusCode.NoContent, setMembers.StatusCode);

        var members = await adminClient.GetFromJsonAsync<List<ProjectMemberResponse>>($"/api/v1/projects/{project.Id}/members");
        Assert.NotNull(members);
        Assert.Contains(members!, x => x.UserId == member.Id);

        var archive = await adminClient.PostAsync($"/api/v1/projects/{project.Id}/archive", null);
        Assert.Equal(HttpStatusCode.NoContent, archive.StatusCode);

        var delete = await adminClient.DeleteAsync($"/api/v1/projects/{project.Id}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
    }

    [Fact]
    public async Task Manager_RemindUser_CreatesNotification()
    {
        var manager = await EnsureUserAsync($"mgr.remind.{Guid.NewGuid():N}"[..19], "manager");
        var employee = await EnsureUserAsync($"emp.remind.{Guid.NewGuid():N}"[..19], "employee");

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            var user = await db.Users.SingleAsync(x => x.Id == employee.Id);
            user.ManagerId = manager.Id;
            await db.SaveChangesAsync();
        }

        using var managerClient = await CreateAuthedClientAsync(manager.Username, "manager123");
        var remind = await managerClient.PostAsync($"/api/v1/manager/remind/{employee.Id}", null);
        Assert.Equal(HttpStatusCode.NoContent, remind.StatusCode);

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        Assert.True(await verifyDb.Notifications.AnyAsync(n => n.UserId == employee.Id && n.Title == "Timesheet Reminder"));
    }

    [Fact]
    public async Task Tenant_Settings_UpdateAndRemoveAssets_Work()
    {
        using var adminClient = await CreateAdminClientAsync();

        using var form = new MultipartFormDataContent
        {
            { new StringContent("Team Hub"), "appName" },
            { new StringContent("#112233"), "primaryColor" },
            { new StringContent("tenant.local"), "customDomain" }
        };

        var update = await adminClient.PutAsync("/api/v1/tenant/settings", form);
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var settings = await update.Content.ReadFromJsonAsync<TenantSettingsResponse>(JsonOptions);
        Assert.NotNull(settings);
        Assert.Equal("Team Hub", settings!.AppName);
        Assert.Equal("#112233", settings.PrimaryColor);
        Assert.Equal("tenant.local", settings.CustomDomain);

        var removeLogo = await adminClient.DeleteAsync("/api/v1/tenant/settings/logo");
        var removeFavicon = await adminClient.DeleteAsync("/api/v1/tenant/settings/favicon");
        Assert.Equal(HttpStatusCode.NoContent, removeLogo.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, removeFavicon.StatusCode);
    }

    [Fact]
    public async Task Leave_UtilityEndpoints_Work()
    {
        var manager = await EnsureUserAsync($"mgr.leave.{Guid.NewGuid():N}"[..18], "manager");
        var employee = await EnsureUserAsync($"emp.leave.{Guid.NewGuid():N}"[..18], "employee");

        DateOnly today;
        DateOnly tomorrow;
        Guid leaveTypeId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            var emp = await db.Users.SingleAsync(x => x.Id == employee.Id);
            emp.ManagerId = manager.Id;

            leaveTypeId = await db.LeaveTypes.Select(x => x.Id).FirstAsync();
            today = DateOnly.FromDateTime(DateTime.UtcNow);
            while (today.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            {
                today = today.AddDays(1);
            }

            tomorrow = today.AddDays(1);
            if (tomorrow.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            {
                tomorrow = tomorrow.AddDays(2);
            }

            db.LeaveRequests.AddRange(
                new LeaveRequest
                {
                    UserId = employee.Id,
                    LeaveTypeId = leaveTypeId,
                    LeaveDate = today,
                    Status = LeaveRequestStatus.Approved,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new LeaveRequest
                {
                    UserId = employee.Id,
                    LeaveTypeId = leaveTypeId,
                    LeaveDate = tomorrow,
                    Status = LeaveRequestStatus.Pending,
                    CreatedAtUtc = DateTime.UtcNow
                });

            await db.SaveChangesAsync();
        }

        using var employeeClient = await CreateAuthedClientAsync(employee.Username, "employee123");
        using var managerClient = await CreateAuthedClientAsync(manager.Username, "manager123");

        var calendar = await employeeClient.GetFromJsonAsync<List<LeaveCalendarDay>>($"/api/v1/leave/calendar?year={today.Year}&month={today.Month}");
        Assert.NotNull(calendar);
        Assert.Contains(calendar!, x => x.Date == today);

        var teamCalendar = await managerClient.GetFromJsonAsync<List<TeamLeaveCalendarDay>>($"/api/v1/leave/team-calendar?year={today.Year}&month={today.Month}");
        Assert.NotNull(teamCalendar);
        Assert.Contains(teamCalendar!, x => x.Entries.Any(e => e.UserId == employee.Id));

        var conflicts = await managerClient.GetFromJsonAsync<LeaveConflictResponse>($"/api/v1/leave/conflicts?fromDate={today:yyyy-MM-dd}&toDate={tomorrow:yyyy-MM-dd}&userId={manager.Id}");
        Assert.NotNull(conflicts);
        Assert.True(conflicts!.ConflictingCount >= 1);

        var teamOnLeave = await managerClient.GetFromJsonAsync<List<TeamLeaveEntryResponse>>("/api/v1/leave/team-on-leave");
        Assert.NotNull(teamOnLeave);
        Assert.Contains(teamOnLeave!, x => x.UserId == employee.Id);
    }

    private async Task<HttpClient> CreateAdminClientAsync()
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "admin123"));
        login.EnsureSuccessStatusCode();
        var payload = await login.Content.ReadFromJsonAsync<LoginResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);
        return client;
    }

    private async Task<HttpClient> CreateAuthedClientAsync(string username, string password)
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(username, password));
        login.EnsureSuccessStatusCode();
        var payload = await login.Content.ReadFromJsonAsync<LoginResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);
        return client;
    }

    private async Task<User> EnsureUserAsync(string username, string role)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var existing = await db.Users.SingleOrDefaultAsync(u => u.Username == username);
        if (existing is not null) return existing;

        var roleEntity = await db.Roles.SingleAsync(r => r.Name == role);
        var policyId = role == "employee"
            ? await db.WorkPolicies.Select(x => (Guid?)x.Id).FirstOrDefaultAsync()
            : null;

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = $"{username}@timesheet.local",
            EmployeeId = $"EMP-{Guid.NewGuid():N}"[..10],
            PasswordHash = hasher.Hash(role == "manager" ? "manager123" : "employee123"),
            Role = role,
            IsActive = true,
            WorkPolicyId = policyId
        };

        db.Users.Add(user);
        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = roleEntity.Id });
        await db.SaveChangesAsync();
        return user;
    }
}

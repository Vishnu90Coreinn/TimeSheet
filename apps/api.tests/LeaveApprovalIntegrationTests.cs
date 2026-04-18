using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Api.Dtos;
using Xunit;

namespace TimeSheet.Api.Tests;

public class LeaveApprovalIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public LeaveApprovalIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Leave_Approve_AdjustsExpectedMinutes_ForHalfDay()
    {
        var setup = await CreateManagerEmployeeSetup("employee.leave.halfday");

        var leaveTypeId = await GetLeaveTypeId();
        var leaveDate = ToNextWeekday(setup.WorkDate);
        var apply = await setup.EmployeeClient.PostAsJsonAsync("/api/v1/leave/requests", new ApplyLeaveRequest(leaveDate, leaveDate, leaveTypeId, true, "medical"));
        Assert.Equal(HttpStatusCode.OK, apply.StatusCode);

        var pending = await setup.ManagerClient.GetFromJsonAsync<PagedResponse<LeaveRequestResponse>>("/api/v1/leave/requests/pending");
        Assert.NotNull(pending);
        var leave = Assert.Single(pending!.Items);

        var review = await setup.ManagerClient.PostAsJsonAsync($"/api/v1/leave/requests/{leave.Id}/review", new ReviewLeaveRequest(true, "ok"));
        Assert.Equal(HttpStatusCode.OK, review.StatusCode);

        var day = await setup.EmployeeClient.GetFromJsonAsync<TimesheetDayResponse>($"/api/v1/timesheets/day?workDate={leaveDate:yyyy-MM-dd}");
        Assert.NotNull(day);
        Assert.Equal(240, day!.ExpectedMinutes);
    }

    [Fact]
    public async Task Leave_PendingRequests_PagedQuery_ReturnsOk()
    {
        var setup = await CreateManagerEmployeeSetup("employee.leave.paged");

        var leaveTypeId = await GetLeaveTypeId();
        var leaveDate = ToNextWeekday(setup.WorkDate);
        var apply = await setup.EmployeeClient.PostAsJsonAsync(
            "/api/v1/leave/requests",
            new ApplyLeaveRequest(leaveDate, leaveDate, leaveTypeId, false, "paged query"));
        Assert.Equal(HttpStatusCode.OK, apply.StatusCode);

        var response = await setup.ManagerClient.GetAsync("/api/v1/leave/requests/pending?page=1&pageSize=200&sortBy=leaveDate&sortDir=desc");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<PagedResponse<LeaveRequestResponse>>();
        Assert.NotNull(payload);
        Assert.Single(payload!.Items);
    }

    [Fact]
    public async Task Timesheet_Reject_RequiresComment()
    {
        var setup = await CreateManagerEmployeeSetup("employee.apr.reject");

        await setup.EmployeeClient.PostAsJsonAsync("/api/v1/attendance/check-in", new CheckInRequest(DateTime.UtcNow.AddHours(-9)));
        await setup.EmployeeClient.PostAsJsonAsync("/api/v1/attendance/check-out", new CheckOutRequest(DateTime.UtcNow));
        await setup.EmployeeClient.PostAsJsonAsync("/api/v1/timesheets/entries", new UpsertTimesheetEntryRequest(setup.WorkDate, null, setup.ProjectId, setup.TaskCategoryId, 60, null));
        await setup.EmployeeClient.PostAsJsonAsync("/api/v1/timesheets/submit", new SubmitTimesheetRequest(setup.WorkDate, null, "mismatch"));

        var reject = await setup.ManagerClient.PostAsJsonAsync($"/api/v1/approvals/timesheets/{setup.TimesheetId}/reject", new TimesheetDecisionRequest(null));
        Assert.Equal(HttpStatusCode.BadRequest, reject.StatusCode);
    }

    [Fact]
    public async Task Timesheet_Approve_WritesHistory()
    {
        var setup = await CreateManagerEmployeeSetup("employee.apr.history");

        await setup.EmployeeClient.PostAsJsonAsync("/api/v1/attendance/check-in", new CheckInRequest(DateTime.UtcNow.AddHours(-9)));
        await setup.EmployeeClient.PostAsJsonAsync("/api/v1/attendance/check-out", new CheckOutRequest(DateTime.UtcNow));
        await setup.EmployeeClient.PostAsJsonAsync("/api/v1/timesheets/entries", new UpsertTimesheetEntryRequest(setup.WorkDate, null, setup.ProjectId, setup.TaskCategoryId, 60, null));
        await setup.EmployeeClient.PostAsJsonAsync("/api/v1/timesheets/submit", new SubmitTimesheetRequest(setup.WorkDate, null, "mismatch"));

        var approve = await setup.ManagerClient.PostAsJsonAsync($"/api/v1/approvals/timesheets/{setup.TimesheetId}/approve", new TimesheetDecisionRequest("ok"));
        Assert.Equal(HttpStatusCode.OK, approve.StatusCode);

        var history = await setup.ManagerClient.GetFromJsonAsync<List<ApprovalActionResponse>>($"/api/v1/approvals/history/{setup.TimesheetId}");
        Assert.NotNull(history);
        Assert.Single(history!);
    }

    private async Task<Guid> GetLeaveTypeId()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        return await db.LeaveTypes.Select(x => x.Id).FirstAsync();
    }

    private async Task<(HttpClient EmployeeClient, HttpClient ManagerClient, Guid ProjectId, Guid TaskCategoryId, Guid TimesheetId, DateOnly WorkDate)> CreateManagerEmployeeSetup(string username)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var managerRole = await db.Roles.SingleAsync(r => r.Name == "manager");
        var employeeRole = await db.Roles.SingleAsync(r => r.Name == "employee");
        var policy = await db.WorkPolicies.FirstAsync();

        var manager = new User { Id = Guid.NewGuid(), Username = $"mgr.{username}", Email = $"mgr.{username}@local", EmployeeId = $"M-{username}", PasswordHash = hasher.Hash("employee123"), Role = "manager", IsActive = true, WorkPolicyId = policy.Id };
        var employee = new User { Id = Guid.NewGuid(), Username = username, Email = $"{username}@local", EmployeeId = $"E-{username}", PasswordHash = hasher.Hash("employee123"), Role = "employee", IsActive = true, WorkPolicyId = policy.Id, ManagerId = manager.Id };

        var project = new Project { Id = Guid.NewGuid(), Name = $"Project {username}", Code = $"PRJ-{Guid.NewGuid():N}"[..10], IsActive = true, IsArchived = false };
        var category = await db.TaskCategories.FirstAsync();
        var workDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var timesheet = new Timesheet { UserId = employee.Id, WorkDate = workDate, Status = TimesheetStatus.Draft };

        db.Users.AddRange(manager, employee);
        db.UserRoles.AddRange(new UserRole { UserId = manager.Id, RoleId = managerRole.Id }, new UserRole { UserId = employee.Id, RoleId = employeeRole.Id });
        db.Projects.Add(project);
        db.ProjectMembers.Add(new ProjectMember { UserId = employee.Id, ProjectId = project.Id });
        db.Timesheets.Add(timesheet);
        await db.SaveChangesAsync();

        var employeeClient = _factory.CreateClient();
        var managerClient = _factory.CreateClient();

        var employeeLogin = await employeeClient.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(username, "employee123"));
        var employeePayload = await employeeLogin.Content.ReadFromJsonAsync<LoginResponse>();
        employeeClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", employeePayload!.AccessToken);

        var managerLogin = await managerClient.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(manager.Username, "employee123"));
        var managerPayload = await managerLogin.Content.ReadFromJsonAsync<LoginResponse>();
        managerClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", managerPayload!.AccessToken);

        return (employeeClient, managerClient, project.Id, category.Id, timesheet.Id, workDate);
    }

    private static DateOnly ToNextWeekday(DateOnly date)
    {
        while (date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
        {
            date = date.AddDays(1);
        }

        return date;
    }
}

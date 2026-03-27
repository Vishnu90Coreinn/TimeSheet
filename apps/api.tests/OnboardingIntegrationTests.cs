using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Api.Dtos;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Infrastructure.Persistence;
using Xunit;

namespace TimeSheet.Api.Tests;

public class OnboardingIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public OnboardingIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task AuthMe_IncludesOnboardingCompletedAt()
    {
        using var setupScope = _factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = setupScope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var role = await db.Roles.SingleAsync(r => r.Name == "employee");
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "onboarding.employee",
            Email = "onboarding.employee@timesheet.local",
            EmployeeId = "EMP-901",
            PasswordHash = hasher.Hash("employee123"),
            Role = "employee",
            IsActive = true,
            TimeZoneId = "Australia/Perth",
            OnboardingCompletedAt = DateTime.UtcNow
        };

        db.Users.Add(user);
        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        await db.SaveChangesAsync();

        using var client = _factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(user.Username, "employee123"));
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var loginPayload = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(loginPayload);
        Assert.NotNull(loginPayload!.OnboardingCompletedAt);
        Assert.Null(loginPayload.LeaveWorkflowVisitedAt);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginPayload.AccessToken);

        var meResponse = await client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);

        var mePayload = await meResponse.Content.ReadFromJsonAsync<UserResponse>();
        Assert.NotNull(mePayload);
        Assert.NotNull(mePayload!.OnboardingCompletedAt);
        Assert.Null(mePayload.LeaveWorkflowVisitedAt);
    }

    [Fact]
    public async Task CompleteOnboarding_SetsTimestampAndReturnsNoContent()
    {
        using var setupScope = _factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = setupScope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var role = await db.Roles.SingleAsync(r => r.Name == "employee");
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "complete.employee",
            Email = "complete.employee@timesheet.local",
            EmployeeId = "EMP-902",
            PasswordHash = hasher.Hash("employee123"),
            Role = "employee",
            IsActive = true
        };

        db.Users.Add(user);
        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        await db.SaveChangesAsync();

        using var client = _factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(user.Username, "employee123"));
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var loginPayload = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(loginPayload);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginPayload!.AccessToken);

        var completeResponse = await client.PostAsync("/api/v1/onboarding/complete", null);
        Assert.Equal(HttpStatusCode.NoContent, completeResponse.StatusCode);

        var refreshedUser = await db.Users.SingleAsync(u => u.Id == user.Id);
        Assert.NotNull(refreshedUser.OnboardingCompletedAt);
    }

    [Fact]
    public async Task Checklist_ForEmployee_ReportsUserSetupSignals()
    {
        using var setupScope = _factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = setupScope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var role = await db.Roles.SingleAsync(r => r.Name == "employee");
        var leaveType = new LeaveType
        {
            Id = Guid.NewGuid(),
            Name = "Annual Leave",
            IsActive = true
        };

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "checklist.employee",
            Email = "checklist.employee@timesheet.local",
            EmployeeId = "EMP-903",
            PasswordHash = hasher.Hash("employee123"),
            Role = "employee",
            IsActive = true,
            TimeZoneId = "Australia/Perth"
        };

        db.Users.Add(user);
        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        db.LeaveTypes.Add(leaveType);
        db.UserNotificationPreferences.Add(new UserNotificationPreferences { UserId = user.Id });
        db.Timesheets.Add(new Timesheet
        {
            UserId = user.Id,
            WorkDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
            Status = TimesheetStatus.Submitted
        });
        db.LeaveRequests.Add(new LeaveRequest
        {
            UserId = user.Id,
            LeaveTypeId = leaveType.Id,
            LeaveDate = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(1)),
            IsHalfDay = false,
            Status = LeaveRequestStatus.Pending
        });
        await db.SaveChangesAsync();

        using var client = _factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(user.Username, "employee123"));
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var loginPayload = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(loginPayload);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginPayload!.AccessToken);

        var response = await client.GetAsync("/api/v1/onboarding/checklist");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<OnboardingChecklistResponse>();
        Assert.NotNull(payload);
        Assert.True(payload!.HasSubmittedTimesheet);
        Assert.True(payload.HasAppliedLeave);
        Assert.True(payload.HasSetTimezone);
        Assert.True(payload.HasSetNotificationPrefs);
        Assert.False(payload.AdminHasProject);
        Assert.False(payload.AdminHasLeavePolicy);
        Assert.False(payload.AdminHasHoliday);
        Assert.True(payload.AdminHasUser);
    }

    [Fact]
    public async Task VisitingLeaveWorkflow_MarksChecklistWithoutSubmittingLeave()
    {
        using var setupScope = _factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = setupScope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var role = await db.Roles.SingleAsync(r => r.Name == "employee");
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "leave.visitor",
            Email = "leave.visitor@timesheet.local",
            EmployeeId = "EMP-905",
            PasswordHash = hasher.Hash("employee123"),
            Role = "employee",
            IsActive = true,
            TimeZoneId = "Australia/Perth"
        };

        db.Users.Add(user);
        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        await db.SaveChangesAsync();

        using var client = _factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(user.Username, "employee123"));
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var loginPayload = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(loginPayload);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginPayload!.AccessToken);

        var visitResponse = await client.PostAsync("/api/v1/onboarding/leave-workflow", null);
        Assert.Equal(HttpStatusCode.NoContent, visitResponse.StatusCode);

        var meResponse = await client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);

        var mePayload = await meResponse.Content.ReadFromJsonAsync<UserResponse>();
        Assert.NotNull(mePayload);
        Assert.NotNull(mePayload!.LeaveWorkflowVisitedAt);

        var checklistResponse = await client.GetAsync("/api/v1/onboarding/checklist");
        Assert.Equal(HttpStatusCode.OK, checklistResponse.StatusCode);

        var checklist = await checklistResponse.Content.ReadFromJsonAsync<OnboardingChecklistResponse>();
        Assert.NotNull(checklist);
        Assert.True(checklist!.HasVisitedLeaveWorkflow);
        Assert.False(checklist.HasAppliedLeave);
    }

    [Fact]
    public async Task Checklist_ForAdmin_ReportsWorkspaceSetupSignals()
    {
        using var setupScope = _factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = setupScope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var admin = await db.Users.SingleAsync(u => u.Username == "admin");
        admin.TimeZoneId = "Australia/Perth";
        admin.OnboardingCompletedAt = null;

        db.Projects.Add(new Project
        {
            Id = Guid.NewGuid(),
            Name = "New Project",
            Code = $"PRJ-{Guid.NewGuid():N}"[..10],
            IsActive = true,
            IsArchived = false
        });
        db.LeavePolicies.Add(new LeavePolicy
        {
            Id = Guid.NewGuid(),
            Name = "Standard Policy",
            IsActive = true
        });
        db.Holidays.Add(new Holiday
        {
            Id = Guid.NewGuid(),
            Name = "Founders Day",
            Date = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(30)),
            IsRecurring = false,
            CreatedAtUtc = DateTime.UtcNow
        });
        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Username = "admin.peer",
            Email = "admin.peer@timesheet.local",
            EmployeeId = "EMP-904",
            PasswordHash = hasher.Hash("employee123"),
            Role = "employee",
            IsActive = true
        });
        await db.SaveChangesAsync();

        using var client = _factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(admin.Username, "admin123"));
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var loginPayload = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(loginPayload);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginPayload!.AccessToken);

        var response = await client.GetAsync("/api/v1/onboarding/checklist");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<OnboardingChecklistResponse>();
        Assert.NotNull(payload);
        Assert.True(payload!.AdminHasProject);
        Assert.True(payload.AdminHasLeavePolicy);
        Assert.True(payload.AdminHasHoliday);
        Assert.True(payload.AdminHasUser);
    }
}

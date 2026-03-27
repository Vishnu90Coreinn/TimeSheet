using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Api.Dtos;
using Xunit;

namespace TimeSheet.Api.Tests;

public class DashboardIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public DashboardIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<string> GetAdminTokenAsync()
    {
        using var client = _factory.CreateClient();
        var r = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "admin123"));
        var payload = await r.Content.ReadFromJsonAsync<LoginResponse>();
        return payload!.AccessToken;
    }

    private async Task<string> GetEmployeeTokenAsync()
    {
        using var setupScope = _factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = setupScope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        const string username = "dashboard.test.employee";
        if (!db.Users.Any(u => u.Username == username))
        {
            db.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                Username = username,
                Email = "dashboard.test@timesheet.local",
                EmployeeId = "EMP-DASH1",
                PasswordHash = hasher.Hash("employee123"),
                Role = "employee",
                IsActive = true
            });
            await db.SaveChangesAsync();
        }

        using var client = _factory.CreateClient();
        var r = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(username, "employee123"));
        var payload = await r.Content.ReadFromJsonAsync<LoginResponse>();
        return payload!.AccessToken;
    }

    [Fact]
    public async Task EmployeeDashboard_Unauthenticated_ReturnsUnauthorized()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/dashboard/employee");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task EmployeeDashboard_AsEmployee_ReturnsOk()
    {
        using var client = _factory.CreateClient();
        var token = await GetEmployeeTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/v1/dashboard/employee");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ManagementDashboard_AsEmployee_ReturnsForbidden()
    {
        using var client = _factory.CreateClient();
        var token = await GetEmployeeTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/v1/dashboard/management");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ManagementDashboard_AsAdmin_ReturnsOk()
    {
        using var client = _factory.CreateClient();
        var token = await GetAdminTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/v1/dashboard/management");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ManagerDashboard_PresentCountsDistinctUsers_NotSessions()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var managerRole = await db.Roles.SingleAsync(r => r.Name == "manager");
        var employeeRole = await db.Roles.SingleAsync(r => r.Name == "employee");
        var policy = await db.WorkPolicies.FirstAsync();

        var suffix = Guid.NewGuid().ToString("N")[..8];
        var manager = new User
        {
            Id = Guid.NewGuid(),
            Username = $"mgr.dashboard.{suffix}",
            Email = $"mgr.dashboard.{suffix}@local",
            EmployeeId = $"MGR-{suffix}",
            PasswordHash = hasher.Hash("employee123"),
            Role = "manager",
            IsActive = true,
            WorkPolicyId = policy.Id
        };

        var employee = new User
        {
            Id = Guid.NewGuid(),
            Username = $"emp.dashboard.{suffix}",
            Email = $"emp.dashboard.{suffix}@local",
            EmployeeId = $"EMP-{suffix}",
            PasswordHash = hasher.Hash("employee123"),
            Role = "employee",
            IsActive = true,
            WorkPolicyId = policy.Id,
            ManagerId = manager.Id
        };

        db.Users.AddRange(manager, employee);
        db.UserRoles.AddRange(
            new UserRole { UserId = manager.Id, RoleId = managerRole.Id },
            new UserRole { UserId = employee.Id, RoleId = employeeRole.Id });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var checkIn = DateTime.UtcNow.AddHours(-2);
        db.WorkSessions.AddRange(
            new WorkSession
            {
                UserId = employee.Id,
                WorkDate = today,
                CheckInAtUtc = checkIn.AddMinutes(-30),
                CheckOutAtUtc = checkIn.AddMinutes(-15),
                Status = WorkSessionStatus.Completed
            },
            new WorkSession
            {
                UserId = employee.Id,
                WorkDate = today,
                CheckInAtUtc = checkIn,
                CheckOutAtUtc = null,
                Status = WorkSessionStatus.Active
            });

        await db.SaveChangesAsync();

        using var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(manager.Username, "employee123"));
        var payload = await login.Content.ReadFromJsonAsync<LoginResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);

        var response = await client.GetAsync("/api/v1/dashboard/manager");
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        var json = JsonSerializer.Deserialize<JsonElement>(body);
        var teamAttendance = json.GetProperty("teamAttendance");

        Assert.Equal(1, teamAttendance.GetProperty("present").GetInt32());
        Assert.Equal(0, teamAttendance.GetProperty("onLeave").GetInt32());
        Assert.Equal(0, teamAttendance.GetProperty("notCheckedIn").GetInt32());
    }
}

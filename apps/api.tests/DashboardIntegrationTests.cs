using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
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

    private async Task<string> CreateManagerWithOneEmployeeHavingManySessionsAsync(int sessionCount)
    {
        using var setupScope = _factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = setupScope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var suffix = Guid.NewGuid().ToString("N")[..8];
        var managerUsername = $"dashboard.manager.{suffix}";
        var employeeUsername = $"dashboard.employee.{suffix}";
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var manager = new User
        {
            Id = Guid.NewGuid(),
            Username = managerUsername,
            Email = $"{managerUsername}@timesheet.local",
            EmployeeId = $"MGR-{suffix.ToUpperInvariant()}",
            PasswordHash = hasher.Hash("manager123"),
            Role = "manager",
            IsActive = true
        };

        var employee = new User
        {
            Id = Guid.NewGuid(),
            Username = employeeUsername,
            Email = $"{employeeUsername}@timesheet.local",
            EmployeeId = $"EMP-{suffix.ToUpperInvariant()}",
            PasswordHash = hasher.Hash("employee123"),
            Role = "employee",
            IsActive = true,
            ManagerId = manager.Id
        };

        db.Users.AddRange(manager, employee);

        var start = DateTime.UtcNow.Date.AddHours(9);
        for (var i = 0; i < sessionCount; i++)
        {
            db.WorkSessions.Add(new WorkSession
            {
                UserId = employee.Id,
                WorkDate = today,
                CheckInAtUtc = start.AddMinutes(i * 30),
                CheckOutAtUtc = start.AddMinutes(i * 30 + 20),
                Status = WorkSessionStatus.Completed
            });
        }

        await db.SaveChangesAsync();

        using var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(managerUsername, "manager123"));
        var payload = await login.Content.ReadFromJsonAsync<LoginResponse>();
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
    public async Task ManagerDashboard_CountsDistinctEmployees_NotSessions()
    {
        using var client = _factory.CreateClient();
        var token = await CreateManagerWithOneEmployeeHavingManySessionsAsync(15);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/v1/dashboard/manager");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var teamAttendance = doc.RootElement.GetProperty("teamAttendance");

        Assert.Equal(1, teamAttendance.GetProperty("present").GetInt32());
        Assert.Equal(0, teamAttendance.GetProperty("onLeave").GetInt32());
        Assert.Equal(0, teamAttendance.GetProperty("notCheckedIn").GetInt32());
    }
}

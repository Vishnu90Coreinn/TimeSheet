using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Services;
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
}

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;
using TimeSheet.Api.Services;
using Xunit;

namespace TimeSheet.Api.Tests;

public class AuthIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AuthIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsTokens()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "admin123"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(payload);
        Assert.False(string.IsNullOrWhiteSpace(payload!.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(payload.RefreshToken));
        Assert.Equal("admin", payload.Username);
    }

    [Fact]
    public async Task Login_WithInvalidCredentials_ReturnsUnauthorized()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "wrong-pass"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ProtectedRoute_WithoutToken_ReturnsUnauthorized()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/projects");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ProtectedRoute_WithToken_ReturnsSuccess()
    {
        using var client = _factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "admin123"));
        var payload = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();

        Assert.NotNull(payload);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);

        var response = await client.GetAsync("/api/v1/projects");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SubmitTimesheet_WhenUserBecomesInactive_ReturnsForbidden()
    {
        using var setupScope = _factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = setupScope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "employee.one",
            Email = "employee.one@timesheet.local",
            EmployeeId = "EMP-100",
            PasswordHash = hasher.Hash("employee123"),
            Role = "employee",
            IsActive = true
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        using var client = _factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(user.Username, "employee123"));
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var loginPayload = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(loginPayload);

        user.IsActive = false;
        await db.SaveChangesAsync();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginPayload!.AccessToken);

        var submitResponse = await client.PostAsJsonAsync("/api/v1/timesheets/submit", new SubmitTimesheetRequest(DateOnly.FromDateTime(DateTime.UtcNow.Date), "Daily update", null));

        Assert.Equal(HttpStatusCode.Forbidden, submitResponse.StatusCode);
    }

    [Fact]
    public async Task SubmitTimesheet_WhenUserIsActive_ReturnsOk()
    {
        using var setupScope = _factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = setupScope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "employee.two",
            Email = "employee.two@timesheet.local",
            EmployeeId = "EMP-200",
            PasswordHash = hasher.Hash("employee123"),
            Role = "employee",
            IsActive = true
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        using var client = _factory.CreateClient();

        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(user.Username, "employee123"));
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var loginPayload = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(loginPayload);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginPayload!.AccessToken);

        var submitResponse = await client.PostAsJsonAsync(
            "/api/v1/timesheets/submit",
            new SubmitTimesheetRequest(DateOnly.FromDateTime(DateTime.UtcNow.Date), "Daily update", null));

        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);
    }
}

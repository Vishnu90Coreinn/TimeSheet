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

public class AccessControlMatrixTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AccessControlMatrixTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Theory]
    [InlineData("anonymous", HttpStatusCode.Unauthorized)]
    [InlineData("employee", HttpStatusCode.OK)]
    [InlineData("manager", HttpStatusCode.OK)]
    [InlineData("admin", HttpStatusCode.OK)]
    public async Task GetProjects_AccessMatrix_IsEnforced(string actorRole, HttpStatusCode expectedStatus)
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsRoleAsync(client, actorRole);

        var response = await client.GetAsync("/api/v1/projects");

        Assert.Equal(expectedStatus, response.StatusCode);
    }

    [Theory]
    [InlineData("anonymous", HttpStatusCode.Unauthorized)]
    [InlineData("employee", HttpStatusCode.Forbidden)]
    [InlineData("manager", HttpStatusCode.Forbidden)]
    [InlineData("admin", HttpStatusCode.OK)]
    public async Task CreateProject_AdminOnlyMatrix_IsEnforced(string actorRole, HttpStatusCode expectedStatus)
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsRoleAsync(client, actorRole);

        var request = new UpsertProjectRequest($"Project-{Guid.NewGuid():N}", $"P-{Guid.NewGuid():N}"[..10], true);
        var response = await client.PostAsJsonAsync("/api/v1/projects", request);

        Assert.Equal(expectedStatus, response.StatusCode);
    }

    [Theory]
    [InlineData("anonymous", HttpStatusCode.Unauthorized)]
    [InlineData("employee", HttpStatusCode.Forbidden)]
    [InlineData("manager", HttpStatusCode.Forbidden)]
    [InlineData("admin", HttpStatusCode.OK)]
    public async Task GetUsers_AdminOnlyMatrix_IsEnforced(string actorRole, HttpStatusCode expectedStatus)
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsRoleAsync(client, actorRole);

        var response = await client.GetAsync("/api/v1/users");

        Assert.Equal(expectedStatus, response.StatusCode);
    }

    [Fact]
    public async Task HealthEndpoint_AllowsAnonymousAccess()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task AuthenticateAsRoleAsync(HttpClient client, string role)
    {
        if (role == "anonymous")
        {
            return;
        }

        var (identifier, password) = role == "admin"
            ? ("admin", "admin123")
            : await EnsureUserWithRoleExistsAsync(role);

        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(identifier, password));
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var payload = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(payload);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);
    }

    private async Task<(string Identifier, string Password)> EnsureUserWithRoleExistsAsync(string role)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var username = $"{role}.{Guid.NewGuid():N}";
        var password = $"{role}123";
        var roleEntity = db.Roles.Single(r => r.Name == role);

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = $"{username}@timesheet.local",
            EmployeeId = $"EMP-{Random.Shared.Next(1000, 9999)}",
            PasswordHash = hasher.Hash(password),
            Role = role,
            IsActive = true
        };

        db.Users.Add(user);
        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = roleEntity.Id });
        await db.SaveChangesAsync();

        return (user.Username, password);
    }
}

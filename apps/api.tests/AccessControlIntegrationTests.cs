using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;
using TimeSheet.Api.Services;
using Xunit;

namespace TimeSheet.Api.Tests;

public class AccessControlIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AccessControlIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Employee_CannotAccess_AdminOnlyRoutes()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var employeeRole = await db.Roles.SingleAsync(r => r.Name == "employee");
        var employee = new User
        {
            Id = Guid.NewGuid(),
            Username = "employee.rbac",
            Email = "employee.rbac@timesheet.local",
            EmployeeId = "EMP-RBAC-1",
            PasswordHash = hasher.Hash("employee123"),
            Role = "employee",
            IsActive = true
        };
        db.Users.Add(employee);
        db.UserRoles.Add(new UserRole { UserId = employee.Id, RoleId = employeeRole.Id });
        await db.SaveChangesAsync();

        using var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(employee.Username, "employee123"));
        var payload = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);

        var usersResponse = await client.GetAsync("/api/v1/users");
        var createRoleResponse = await client.PostAsJsonAsync("/api/v1/roles", new AssignRoleRequest("contractor"));

        Assert.Equal(HttpStatusCode.Forbidden, usersResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, createRoleResponse.StatusCode);
    }

    [Fact]
    public async Task Admin_CanManage_ProjectsAndTaskCategories()
    {
        using var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "admin123"));
        var payload = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);

        var createProject = await client.PostAsJsonAsync("/api/v1/projects", new UpsertProjectRequest("Timesheet Revamp", "PRJ-RBAC", true));
        var createCategory = await client.PostAsJsonAsync("/api/v1/task-categories", new UpsertTaskCategoryRequest("Code Review", true));

        Assert.Equal(HttpStatusCode.OK, createProject.StatusCode);
        Assert.Equal(HttpStatusCode.OK, createCategory.StatusCode);
    }
}

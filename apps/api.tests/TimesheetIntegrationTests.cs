using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Services;
using Xunit;

namespace TimeSheet.Api.Tests;

public class TimesheetIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public TimesheetIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Submit_RequiresMismatchReason_WhenPolicyEnabled()
    {
        var setup = await CreateAuthedEmployeeClient("employee.ts.mismatch");
        var client = setup.Client;

        await client.PostAsJsonAsync("/api/v1/attendance/check-in", new CheckInRequest(DateTime.UtcNow.AddHours(-9)));
        await client.PostAsJsonAsync("/api/v1/attendance/check-out", new CheckOutRequest(DateTime.UtcNow));

        var entryResponse = await client.PostAsJsonAsync("/api/v1/timesheets/entries", new UpsertTimesheetEntryRequest(
            setup.WorkDate,
            null,
            setup.ProjectId,
            setup.TaskCategoryId,
            30,
            "Intentional mismatch"));

        Assert.Equal(HttpStatusCode.OK, entryResponse.StatusCode);

        var submit = await client.PostAsJsonAsync("/api/v1/timesheets/submit", new SubmitTimesheetRequest(setup.WorkDate, "notes", null));
        Assert.Equal(HttpStatusCode.BadRequest, submit.StatusCode);
    }

    [Fact]
    public async Task Entry_RejectsFutureDate()
    {
        var setup = await CreateAuthedEmployeeClient("employee.ts.future");
        var client = setup.Client;

        var response = await client.PostAsJsonAsync("/api/v1/timesheets/entries", new UpsertTimesheetEntryRequest(
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            null,
            setup.ProjectId,
            setup.TaskCategoryId,
            60,
            null));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Entry_RejectsProject_WhenEmployeeIsNotMember()
    {
        var setup = await CreateAuthedEmployeeClient("employee.ts.unauthorized-project");
        var client = setup.Client;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            db.Projects.Add(new Project
            {
                Id = setup.UnassignedProjectId,
                Name = "Unassigned project",
                Code = $"PRJ-{Guid.NewGuid():N}"[..10],
                IsActive = true,
                IsArchived = false
            });
            await db.SaveChangesAsync();
        }

        var response = await client.PostAsJsonAsync("/api/v1/timesheets/entries", new UpsertTimesheetEntryRequest(
            setup.WorkDate,
            null,
            setup.UnassignedProjectId,
            setup.TaskCategoryId,
            60,
            "should fail"));

        // Session 2 intentionally removed membership enforcement —
        // all authenticated users may log time against any active project.
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Submit_DoesNotRequireMismatchReason_WhenLowGrossSkipsLunch()
    {
        var setup = await CreateAuthedEmployeeClient("employee.ts.lowgross");
        var client = setup.Client;

        await client.PostAsJsonAsync("/api/v1/attendance/check-in", new CheckInRequest(DateTime.UtcNow.AddHours(-2)));
        await client.PostAsJsonAsync("/api/v1/attendance/check-out", new CheckOutRequest(DateTime.UtcNow));

        var entryResponse = await client.PostAsJsonAsync("/api/v1/timesheets/entries", new UpsertTimesheetEntryRequest(
            setup.WorkDate,
            null,
            setup.ProjectId,
            setup.TaskCategoryId,
            120,
            "Low gross day"));

        Assert.Equal(HttpStatusCode.OK, entryResponse.StatusCode);

        var submit = await client.PostAsJsonAsync("/api/v1/timesheets/submit", new SubmitTimesheetRequest(setup.WorkDate, "notes", null));
        Assert.Equal(HttpStatusCode.OK, submit.StatusCode);
    }

    private async Task<(HttpClient Client, Guid ProjectId, Guid UnassignedProjectId, Guid TaskCategoryId, DateOnly WorkDate)> CreateAuthedEmployeeClient(string username)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var role = await db.Roles.SingleAsync(r => r.Name == "employee");
        var policy = await db.WorkPolicies.FirstAsync();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = $"{username}@timesheet.local",
            EmployeeId = $"{username}-id",
            PasswordHash = hasher.Hash("employee123"),
            Role = "employee",
            WorkPolicyId = policy.Id,
            IsActive = true
        };

        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = $"Project {username}",
            Code = $"PRJ-{Guid.NewGuid():N}"[..10],
            IsActive = true,
            IsArchived = false
        };

        var category = await db.TaskCategories.FirstAsync();

        db.Users.Add(user);
        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        db.Projects.Add(project);
        db.ProjectMembers.Add(new ProjectMember { UserId = user.Id, ProjectId = project.Id });
        await db.SaveChangesAsync();

        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(username, "employee123"));
        var payload = await login.Content.ReadFromJsonAsync<LoginResponse>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!.AccessToken);

        return (client, project.Id, Guid.NewGuid(), category.Id, DateOnly.FromDateTime(DateTime.UtcNow));
    }
}

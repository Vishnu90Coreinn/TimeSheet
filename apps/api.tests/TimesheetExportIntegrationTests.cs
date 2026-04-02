using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Api.Dtos;
using Xunit;

namespace TimeSheet.Api.Tests;

public class TimesheetExportIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public TimesheetExportIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<string> GetTokenAsync(string username, string password)
    {
        using var client = _factory.CreateClient();
        var r = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(username, password));
        var payload = await r.Content.ReadFromJsonAsync<LoginResponse>();
        return payload!.AccessToken;
    }

    private async Task EnsureEmployeeAsync(string username, string role = "employee", Guid? managerId = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        if (await db.Users.AnyAsync(u => u.Username == username))
            return;

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = $"{username}@timesheet.local",
            EmployeeId = $"EMP-{Guid.NewGuid():N}"[..10],
            PasswordHash = hasher.Hash("employee123"),
            Role = role,
            IsActive = true,
            ManagerId = managerId
        };

        db.Users.Add(user);

        var roleEntity = await db.Roles.SingleAsync(r => r.Name == role);
        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = roleEntity.Id });

        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task ExportUsers_Unauthenticated_Returns401()
    {
        using var client = _factory.CreateClient();
        var r = await client.GetAsync("/api/v1/timesheets/export/users");
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
    }

    [Fact]
    public async Task ExportUsers_AsAdmin_ReturnsOkWithUsers()
    {
        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.GetAsync("/api/v1/timesheets/export/users");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var users = await r.Content.ReadFromJsonAsync<List<TimesheetExportUserDto>>();
        Assert.NotNull(users);
        Assert.NotEmpty(users);
    }

    [Fact]
    public async Task ExportUsers_AsEmployee_ReturnsSingleSelf()
    {
        await EnsureEmployeeAsync("employee1");

        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("employee1", "employee123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.GetAsync("/api/v1/timesheets/export/users");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var users = await r.Content.ReadFromJsonAsync<List<TimesheetExportUserDto>>();
        Assert.NotNull(users);
        Assert.Single(users);
    }

    [Fact]
    public async Task Export_Unauthenticated_Returns401()
    {
        using var client = _factory.CreateClient();
        var r = await client.GetAsync("/api/v1/timesheets/export?fromDate=2025-01-01&toDate=2025-01-31");
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
    }

    [Fact]
    public async Task Export_MissingDateRange_Returns400()
    {
        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.GetAsync("/api/v1/timesheets/export");
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    [Fact]
    public async Task Export_AsAdmin_Csv_ReturnsCsvFile()
    {
        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.GetAsync("/api/v1/timesheets/export?fromDate=2025-01-01&toDate=2025-01-31&format=csv");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("text/csv", r.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Export_AsAdmin_Excel_ReturnsExcelFile()
    {
        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.GetAsync("/api/v1/timesheets/export?fromDate=2025-01-01&toDate=2025-01-31&format=excel");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            r.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Export_AsAdmin_Pdf_ReturnsPdfFile()
    {
        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.GetAsync("/api/v1/timesheets/export?fromDate=2025-01-01&toDate=2025-01-31&format=pdf");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("application/pdf", r.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Export_AsEmployee_WithAnotherUserId_Returns403()
    {
        await EnsureEmployeeAsync("employee1");

        using var client = _factory.CreateClient();
        var adminToken = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var users = await (await client.GetAsync("/api/v1/timesheets/export/users")).Content.ReadFromJsonAsync<List<TimesheetExportUserDto>>();
        var adminId = users!.Single(u => u.Username == "admin").Id;

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            await GetTokenAsync("employee1", "employee123"));
        var r = await client.GetAsync($"/api/v1/timesheets/export?fromDate=2025-01-01&toDate=2025-01-31&userId={adminId}");
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
    }

    [Fact]
    public async Task Export_DateRange_TooLarge_Returns400()
    {
        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.GetAsync("/api/v1/timesheets/export?fromDate=2023-01-01&toDate=2025-01-01");
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }
}

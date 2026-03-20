using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Api.Dtos;
using Xunit;

namespace TimeSheet.Api.Tests;

public class HolidaysIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public HolidaysIntegrationTests(CustomWebApplicationFactory factory)
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

        const string username = "holiday.test.employee";
        if (!db.Users.Any(u => u.Username == username))
        {
            db.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                Username = username,
                Email = "holiday.test@timesheet.local",
                EmployeeId = "EMP-HOL1",
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
    public async Task GetHolidays_Unauthenticated_ReturnsOk()
    {
        // Holidays are a public endpoint — no auth required for GET
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/holidays?year=2026");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetHolidays_WithYear_ReturnsSeededHolidays()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/holidays?year=2026");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        var holidays = JsonSerializer.Deserialize<JsonElement[]>(body);
        Assert.NotNull(holidays);
        Assert.True(holidays!.Length >= 1, "Expected at least one seeded holiday for 2026");
    }

    [Fact]
    public async Task CreateHoliday_AsAdmin_ReturnsCreated()
    {
        using var client = _factory.CreateClient();
        var token = await GetAdminTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var body = new StringContent(
            JsonSerializer.Serialize(new { name = "Test Holiday", date = "2026-07-04", isRecurring = false }),
            Encoding.UTF8, "application/json");

        var response = await client.PostAsync("/api/v1/holidays", body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task CreateHoliday_AsEmployee_ReturnsForbidden()
    {
        using var client = _factory.CreateClient();
        var token = await GetEmployeeTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var body = new StringContent(
            JsonSerializer.Serialize(new { name = "Unauthorized Holiday", date = "2026-08-01", isRecurring = false }),
            Encoding.UTF8, "application/json");

        var response = await client.PostAsync("/api/v1/holidays", body);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DeleteHoliday_AsAdmin_ReturnsNoContent()
    {
        using var client = _factory.CreateClient();
        var token = await GetAdminTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Create a holiday to delete
        var createBody = new StringContent(
            JsonSerializer.Serialize(new { name = "Holiday To Delete", date = "2026-09-15", isRecurring = false }),
            Encoding.UTF8, "application/json");
        var createResponse = await client.PostAsync("/api/v1/holidays", createBody);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = JsonSerializer.Deserialize<JsonElement>(await createResponse.Content.ReadAsStringAsync());
        var id = created.GetProperty("id").GetString();

        var deleteResponse = await client.DeleteAsync($"/api/v1/holidays/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }
}

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TimeSheet.Api.Dtos;
using Xunit;

namespace TimeSheet.Api.Tests;

public class NotificationsIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public NotificationsIntegrationTests(CustomWebApplicationFactory factory)
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

    [Fact]
    public async Task GetNotifications_Unauthenticated_ReturnsUnauthorized()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/notifications");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetNotifications_AsEmployee_ReturnsOkWithList()
    {
        using var client = _factory.CreateClient();
        var token = await GetAdminTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/v1/notifications");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.NotNull(body);
        // Response is a JSON array (may be empty)
        Assert.Contains("[", body);
    }

    [Fact]
    public async Task MarkAllRead_AsEmployee_ReturnsNoContent()
    {
        using var client = _factory.CreateClient();
        var token = await GetAdminTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PutAsync("/api/v1/notifications/read-all", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}

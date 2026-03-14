using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TimeSheet.Api.Dtos;
using Xunit;

namespace TimeSheet.Api.Tests;

public class ReportsIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public ReportsIntegrationTests(CustomWebApplicationFactory factory)
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
    public async Task AttendanceSummary_Unauthenticated_ReturnsUnauthorized()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/reports/attendance-summary");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AttendanceSummary_AsAdmin_ReturnsOk()
    {
        using var client = _factory.CreateClient();
        var token = await GetAdminTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/v1/reports/attendance-summary");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task TimesheetSummary_AsAdmin_ReturnsOk()
    {
        using var client = _factory.CreateClient();
        var token = await GetAdminTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/v1/reports/timesheet-summary");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ProjectEffort_AsAdmin_ReturnsOk()
    {
        using var client = _factory.CreateClient();
        var token = await GetAdminTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/v1/reports/project-effort");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task LeaveUtilization_AsAdmin_ReturnsOk()
    {
        using var client = _factory.CreateClient();
        var token = await GetAdminTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/v1/reports/leave-utilization");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}

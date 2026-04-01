using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Api.Dtos;
using Xunit;

namespace TimeSheet.Api.Tests;

public class AdminAuditLogsIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AdminAuditLogsIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<string> GetAdminTokenAsync()
    {
        using var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "admin123"));
        var payload = await login.Content.ReadFromJsonAsync<LoginResponse>();
        return payload!.AccessToken;
    }

    [Fact]
    public async Task GetAuditLogs_IncludesHasFieldChanges()
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                Action = "UserUpdated",
                EntityType = "User",
                EntityId = Guid.NewGuid().ToString(),
                HasFieldChanges = true,
                SourceContext = "ManualCall",
                CreatedAtUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        using var client = _factory.CreateClient();
        var token = await GetAdminTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/v1/admin/audit-logs?page=1&pageSize=20");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var first = payload.RootElement.GetProperty("items")[0];
        Assert.True(first.TryGetProperty("hasFieldChanges", out var hasFieldChanges));
        Assert.True(hasFieldChanges.GetBoolean());
    }

    [Fact]
    public async Task GetAuditChanges_ReturnsFieldLevelChangesForLog()
    {
        Guid auditLogId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                Action = "UserUpdated",
                EntityType = "User",
                EntityId = Guid.NewGuid().ToString(),
                HasFieldChanges = true,
                SourceContext = "ManualCall",
                CreatedAtUtc = DateTime.UtcNow,
                Changes =
                [
                    new AuditLogChange
                    {
                        Id = Guid.NewGuid(),
                        FieldName = "DisplayName",
                        OldValue = "Old Name",
                        NewValue = "New Name",
                        ValueType = "String",
                        IsMasked = false
                    }
                ]
            };

            db.AuditLogs.Add(auditLog);
            await db.SaveChangesAsync();
            auditLogId = auditLog.Id;
        }

        using var client = _factory.CreateClient();
        var token = await GetAdminTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync($"/api/v1/admin/audit-logs/{auditLogId}/changes");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var first = payload.RootElement[0];
        Assert.Equal("DisplayName", first.GetProperty("fieldName").GetString());
        Assert.Equal("Old Name", first.GetProperty("oldValue").GetString());
        Assert.Equal("New Name", first.GetProperty("newValue").GetString());
    }

    [Fact]
    public async Task GetEntityHistory_ReturnsEntitySpecificAuditTrail()
    {
        var entityId = Guid.NewGuid().ToString();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            db.AuditLogs.AddRange(
                new AuditLog
                {
                    Id = Guid.NewGuid(),
                    Action = "UserCreated",
                    EntityType = "User",
                    EntityId = entityId,
                    SourceContext = "ManualCall",
                    CreatedAtUtc = DateTime.UtcNow.AddMinutes(-5)
                },
                new AuditLog
                {
                    Id = Guid.NewGuid(),
                    Action = "UserUpdated",
                    EntityType = "User",
                    EntityId = entityId,
                    SourceContext = "ManualCall",
                    CreatedAtUtc = DateTime.UtcNow
                });
            await db.SaveChangesAsync();
        }

        using var client = _factory.CreateClient();
        var token = await GetAdminTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync($"/api/v1/admin/audit-logs/entities/User/{entityId}?page=1&pageSize=20");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(2, payload.RootElement.GetArrayLength());
        Assert.Equal("UserUpdated", payload.RootElement[0].GetProperty("action").GetString());
        Assert.Equal("UserCreated", payload.RootElement[1].GetProperty("action").GetString());
    }
}

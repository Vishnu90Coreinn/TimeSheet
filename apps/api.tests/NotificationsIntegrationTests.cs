using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Api.Dtos;
using Xunit;

namespace TimeSheet.Api.Tests;

public class NotificationsIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly CustomWebApplicationFactory _factory;

    public NotificationsIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<string> GetEmployeeTokenAsync(string username)
    {
        using var setupScope = _factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = setupScope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var employeeRole = await db.Roles.SingleAsync(r => r.Name == "employee");
        var user = await db.Users.SingleOrDefaultAsync(u => u.Username == username);
        if (user is null)
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                Username = username,
                Email = $"{username}@timesheet.local",
                EmployeeId = $"EMP-{Guid.NewGuid():N}"[..10],
                PasswordHash = hasher.Hash("employee123"),
                Role = "employee",
                IsActive = true
            };

            db.Users.Add(user);
            db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = employeeRole.Id });
            await db.SaveChangesAsync();
        }

        using var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(username, "employee123"));
        var payload = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return payload!.AccessToken;
    }

    private async Task<User> CreateEmployeeAsync(string username)
    {
        using var setupScope = _factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var hasher = setupScope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var employeeRole = await db.Roles.SingleAsync(r => r.Name == "employee");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = $"{username}@timesheet.local",
            EmployeeId = $"EMP-{Guid.NewGuid():N}"[..10],
            PasswordHash = hasher.Hash("employee123"),
            Role = "employee",
            IsActive = true
        };

        db.Users.Add(user);
        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = employeeRole.Id });
        await db.SaveChangesAsync();
        return user;
    }

    private async Task SeedNotificationAsync(
        Guid userId,
        string title,
        string message,
        bool isRead,
        DateTime createdAtUtc,
        string? groupKey = null,
        string? actionUrl = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();

        db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = title,
            Message = message,
            Type = NotificationType.MissingTimesheetReminder,
            IsRead = isRead,
            CreatedAtUtc = createdAtUtc,
            GroupKey = groupKey,
            ActionUrl = actionUrl
        });

        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetNotifications_ReturnsPagedFeedWithUnreadCountAndMetadata()
    {
        var user = await CreateEmployeeAsync("notifications.employee.feed");
        var otherUser = await CreateEmployeeAsync("notifications.employee.other");

        var now = DateTime.UtcNow;
        await SeedNotificationAsync(user.Id, "Newest", "Newest message", false, now.AddMinutes(-1), "work-session", "/attendance");
        await SeedNotificationAsync(user.Id, "Second", "Second message", true, now.AddMinutes(-2), "work-session", "/attendance");
        await SeedNotificationAsync(user.Id, "Third", "Third message", false, now.AddMinutes(-3), "leave-request", "/leave");
        await SeedNotificationAsync(otherUser.Id, "Other user", "Should not leak", false, now.AddMinutes(-4), "other", "/other");

        using var client = _factory.CreateClient();
        var token = await GetEmployeeTokenAsync(user.Username);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/v1/notifications?page=1&pageSize=2");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = JsonSerializer.Deserialize<NotificationPageResponse>(
            await response.Content.ReadAsStringAsync(),
            JsonOptions);

        Assert.NotNull(payload);
        Assert.Equal(2, payload!.Items.Count);
        Assert.Equal(2, payload.TotalUnread);
        Assert.True(payload.HasMore);
        Assert.Equal("Newest", payload.Items[0].Title);
        Assert.Equal("Second", payload.Items[1].Title);
        Assert.Equal("work-session", payload.Items[0].GroupKey);
        Assert.Equal("/attendance", payload.Items[0].ActionUrl);
        Assert.False(payload.Items[0].IsRead);
        Assert.True(payload.Items[1].IsRead);
    }

    [Fact]
    public async Task MarkAllRead_MarksCurrentUsersNotificationsRead()
    {
        var user = await CreateEmployeeAsync("notifications.employee.readall");
        var now = DateTime.UtcNow;
        await SeedNotificationAsync(user.Id, "Unread one", "message", false, now.AddMinutes(-1));
        await SeedNotificationAsync(user.Id, "Unread two", "message", false, now.AddMinutes(-2));

        using var client = _factory.CreateClient();
        var token = await GetEmployeeTokenAsync(user.Username);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PostAsync("/api/v1/notifications/mark-all-read", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var verifyScope = _factory.Services.CreateScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var unreadCount = await db.Notifications.CountAsync(n => n.UserId == user.Id && !n.IsRead);
        Assert.Equal(0, unreadCount);
    }

    [Fact]
    public async Task DeleteNotification_RemovesOnlyCurrentUsersNotification()
    {
        var user = await CreateEmployeeAsync("notifications.employee.deleteone");
        var otherUser = await CreateEmployeeAsync("notifications.employee.deleteone.other");

        var now = DateTime.UtcNow;
        await SeedNotificationAsync(user.Id, "Keep", "message", false, now.AddMinutes(-1));
        await SeedNotificationAsync(otherUser.Id, "Other", "message", false, now.AddMinutes(-2));

        using var setupScope = _factory.Services.CreateScope();
        var db = setupScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var targetId = await db.Notifications.Where(n => n.UserId == user.Id).Select(n => n.Id).SingleAsync();
        var otherId = await db.Notifications.Where(n => n.UserId == otherUser.Id).Select(n => n.Id).SingleAsync();

        using var client = _factory.CreateClient();
        var token = await GetEmployeeTokenAsync(user.Username);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.DeleteAsync($"/api/v1/notifications/{targetId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        Assert.False(await verifyDb.Notifications.AnyAsync(n => n.Id == targetId));
        Assert.True(await verifyDb.Notifications.AnyAsync(n => n.Id == otherId));
    }

    [Fact]
    public async Task ClearNotifications_RemovesAllCurrentUsersNotifications()
    {
        var user = await CreateEmployeeAsync("notifications.employee.clearall");
        var otherUser = await CreateEmployeeAsync("notifications.employee.clearall.other");

        var now = DateTime.UtcNow;
        await SeedNotificationAsync(user.Id, "One", "message", false, now.AddMinutes(-1));
        await SeedNotificationAsync(user.Id, "Two", "message", true, now.AddMinutes(-2));
        await SeedNotificationAsync(otherUser.Id, "Other", "message", false, now.AddMinutes(-3));

        using var client = _factory.CreateClient();
        var token = await GetEmployeeTokenAsync(user.Username);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.DeleteAsync("/api/v1/notifications");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var verifyScope = _factory.Services.CreateScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        Assert.Equal(0, await db.Notifications.CountAsync(n => n.UserId == user.Id));
        Assert.Equal(1, await db.Notifications.CountAsync(n => n.UserId == otherUser.Id));
    }

    internal sealed record NotificationPageResponse(
        IReadOnlyList<NotificationPageItemResponse> Items,
        int TotalUnread,
        bool HasMore);

    internal sealed record NotificationPageItemResponse(
        Guid Id,
        string Title,
        string Message,
        string Type,
        bool IsRead,
        DateTime CreatedAtUtc,
        string? GroupKey,
        string? ActionUrl);
}

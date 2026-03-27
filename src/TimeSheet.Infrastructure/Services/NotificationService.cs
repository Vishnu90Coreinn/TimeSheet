using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Infrastructure.Persistence;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public interface INotificationService
{
    Task CreateAsync(Guid userId, string title, string message, NotificationType type, string? groupKey = null, string? actionUrl = null);
    Task<List<Notification>> GetUnreadAsync(Guid userId);
    Task<(IReadOnlyList<Notification> Items, bool HasMore)> GetPageAsync(Guid userId, int page, int pageSize);
    Task<int> CountUnreadAsync(Guid userId);
    Task<bool> MarkReadAsync(Guid notificationId, Guid userId);
    Task<int> MarkAllReadAsync(Guid userId);
    Task<bool> DeleteAsync(Guid notificationId, Guid userId);
    Task<int> DeleteAllAsync(Guid userId);
}

public class NotificationService(TimeSheetDbContext dbContext) : INotificationService, AppInterfaces.INotificationService
{
    public async Task CreateAsync(Guid userId, string title, string message, NotificationType type, string? groupKey = null, string? actionUrl = null)
    {
        dbContext.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = title,
            Message = message,
            GroupKey = groupKey,
            ActionUrl = actionUrl,
            Type = type,
            IsRead = false,
            CreatedAtUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
    }

    public async Task<List<Notification>> GetUnreadAsync(Guid userId)
    {
        return await dbContext.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId && !n.IsRead)
            .OrderByDescending(n => n.CreatedAtUtc)
            .ToListAsync();
    }

    public async Task<(IReadOnlyList<Notification> Items, bool HasMore)> GetPageAsync(Guid userId, int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var items = await dbContext.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAtUtc)
            .ThenByDescending(n => n.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize + 1)
            .ToListAsync();

        var hasMore = items.Count > pageSize;
        if (hasMore)
            items = items.Take(pageSize).ToList();

        return (items, hasMore);
    }

    public Task<int> CountUnreadAsync(Guid userId)
        => dbContext.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);

    public async Task<bool> MarkReadAsync(Guid notificationId, Guid userId)
    {
        var notification = await dbContext.Notifications.SingleOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);
        if (notification is not null)
        {
            notification.IsRead = true;
            await dbContext.SaveChangesAsync();
            return true;
        }

        return false;
    }

    public async Task<int> MarkAllReadAsync(Guid userId)
    {
        var unread = await dbContext.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();
        foreach (var n in unread) n.IsRead = true;
        if (unread.Count > 0) await dbContext.SaveChangesAsync();
        return unread.Count;
    }

    public async Task<bool> DeleteAsync(Guid notificationId, Guid userId)
    {
        var notification = await dbContext.Notifications.SingleOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);
        if (notification is null)
            return false;

        dbContext.Notifications.Remove(notification);
        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<int> DeleteAllAsync(Guid userId)
    {
        var notifications = await dbContext.Notifications
            .Where(n => n.UserId == userId)
            .ToListAsync();

        if (notifications.Count == 0)
            return 0;

        dbContext.Notifications.RemoveRange(notifications);
        await dbContext.SaveChangesAsync();
        return notifications.Count;
    }
}

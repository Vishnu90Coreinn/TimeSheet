using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Infrastructure.Persistence;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public interface INotificationService
{
    Task CreateAsync(Guid userId, string title, string message, NotificationType type);
    Task<List<Notification>> GetUnreadAsync(Guid userId);
    Task MarkReadAsync(Guid notificationId, Guid userId);
    Task MarkAllReadAsync(Guid userId);
}

public class NotificationService(TimeSheetDbContext dbContext) : INotificationService, AppInterfaces.INotificationService
{
    public async Task CreateAsync(Guid userId, string title, string message, NotificationType type)
    {
        dbContext.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = title,
            Message = message,
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

    public async Task MarkReadAsync(Guid notificationId, Guid userId)
    {
        var notification = await dbContext.Notifications.SingleOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);
        if (notification is not null)
        {
            notification.IsRead = true;
            await dbContext.SaveChangesAsync();
        }
    }

    public async Task MarkAllReadAsync(Guid userId)
    {
        var unread = await dbContext.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();
        foreach (var n in unread) n.IsRead = true;
        if (unread.Count > 0) await dbContext.SaveChangesAsync();
    }
}

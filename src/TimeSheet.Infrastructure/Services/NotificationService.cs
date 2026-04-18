using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;
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

public class NotificationService(INotificationRepository notificationRepository, IUnitOfWork unitOfWork) : INotificationService, AppInterfaces.INotificationService
{
    public async Task CreateAsync(Guid userId, string title, string message, NotificationType type, string? groupKey = null, string? actionUrl = null)
    {
        notificationRepository.Add(new Notification
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
        await unitOfWork.SaveChangesAsync();
    }

    public async Task<List<Notification>> GetUnreadAsync(Guid userId)
        => (await notificationRepository.GetUnreadByUserAsync(userId)).ToList();

    public async Task<(IReadOnlyList<Notification> Items, bool HasMore)> GetPageAsync(Guid userId, int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        return await notificationRepository.GetPageByUserAsync(userId, page, pageSize);
    }

    public Task<int> CountUnreadAsync(Guid userId)
        => notificationRepository.CountUnreadByUserAsync(userId);

    public async Task<bool> MarkReadAsync(Guid notificationId, Guid userId)
    {
        var notification = await notificationRepository.GetByIdAsync(notificationId);
        if (notification is null || notification.UserId != userId)
            return false;

        notification.IsRead = true;
        await unitOfWork.SaveChangesAsync();
        return true;
    }

    public async Task<int> MarkAllReadAsync(Guid userId)
    {
        var unread = (await notificationRepository.GetAllByUserAsync(userId))
            .Where(n => !n.IsRead)
            .ToList();
        foreach (var n in unread) n.IsRead = true;
        if (unread.Count > 0) await unitOfWork.SaveChangesAsync();
        return unread.Count;
    }

    public async Task<bool> DeleteAsync(Guid notificationId, Guid userId)
    {
        var notification = await notificationRepository.GetByIdAsync(notificationId);
        if (notification is null || notification.UserId != userId)
            return false;

        notificationRepository.Remove(notification);
        await unitOfWork.SaveChangesAsync();
        return true;
    }

    public async Task<int> DeleteAllAsync(Guid userId)
    {
        var notifications = await notificationRepository.GetAllByUserAsync(userId);
        if (notifications.Count == 0)
            return 0;

        notificationRepository.RemoveRange(notifications);
        await unitOfWork.SaveChangesAsync();
        return notifications.Count;
    }
}

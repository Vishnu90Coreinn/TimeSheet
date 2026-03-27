using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;

namespace TimeSheet.Application.Common.Interfaces;

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

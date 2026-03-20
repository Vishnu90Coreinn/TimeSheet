using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;

namespace TimeSheet.Application.Common.Interfaces;

public interface INotificationService
{
    Task CreateAsync(Guid userId, string title, string message, NotificationType type);
    Task<List<Notification>> GetUnreadAsync(Guid userId);
    Task MarkReadAsync(Guid notificationId, Guid userId);
    Task MarkAllReadAsync(Guid userId);
}

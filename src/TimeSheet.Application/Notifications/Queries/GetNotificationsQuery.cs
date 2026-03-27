using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Notifications.Queries;

public record GetNotificationsQuery(int Page, int PageSize) : IRequest<Result<NotificationsPageResult>>;

public record NotificationItemResult(
    Guid Id,
    string Title,
    string Message,
    string Type,
    bool IsRead,
    DateTime CreatedAtUtc,
    string? GroupKey,
    string? ActionUrl);

public record NotificationsPageResult(
    IReadOnlyList<NotificationItemResult> Items,
    int TotalUnread,
    bool HasMore);

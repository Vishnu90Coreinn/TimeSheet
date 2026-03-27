using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Notifications.Queries;

public class GetNotificationsQueryHandler(
    INotificationService notificationService,
    ICurrentUserService currentUser)
    : IRequestHandler<GetNotificationsQuery, Result<NotificationsPageResult>>
{
    public async Task<Result<NotificationsPageResult>> Handle(GetNotificationsQuery request, CancellationToken cancellationToken)
    {
        var (items, hasMore) = await notificationService.GetPageAsync(currentUser.UserId, request.Page, request.PageSize);
        var unreadCount = await notificationService.CountUnreadAsync(currentUser.UserId);

        var response = new NotificationsPageResult(
            items.Select(n => new NotificationItemResult(
                n.Id,
                n.Title,
                n.Message,
                n.Type.ToString(),
                n.IsRead,
                n.CreatedAtUtc,
                n.GroupKey,
                n.ActionUrl)).ToList(),
            unreadCount,
            hasMore);

        return Result<NotificationsPageResult>.Success(response);
    }
}

using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Notifications.Commands;

public class MarkAllNotificationsReadCommandHandler(
    INotificationService notificationService,
    ICurrentUserService currentUser)
    : IRequestHandler<MarkAllNotificationsReadCommand, Result>
{
    public async Task<Result> Handle(MarkAllNotificationsReadCommand request, CancellationToken cancellationToken)
    {
        await notificationService.MarkAllReadAsync(currentUser.UserId);
        return Result.Success();
    }
}

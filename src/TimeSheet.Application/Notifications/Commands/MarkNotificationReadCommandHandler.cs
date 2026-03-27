using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Notifications.Commands;

public class MarkNotificationReadCommandHandler(
    INotificationService notificationService,
    ICurrentUserService currentUser)
    : IRequestHandler<MarkNotificationReadCommand, Result>
{
    public async Task<Result> Handle(MarkNotificationReadCommand request, CancellationToken cancellationToken)
    {
        var marked = await notificationService.MarkReadAsync(request.NotificationId, currentUser.UserId);
        return marked ? Result.Success() : Result.NotFound("Notification not found.");
    }
}

using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Notifications.Commands;

public class DeleteNotificationCommandHandler(
    INotificationService notificationService,
    ICurrentUserService currentUser)
    : IRequestHandler<DeleteNotificationCommand, Result>
{
    public async Task<Result> Handle(DeleteNotificationCommand request, CancellationToken cancellationToken)
    {
        var deleted = await notificationService.DeleteAsync(request.NotificationId, currentUser.UserId);
        return deleted ? Result.Success() : Result.NotFound("Notification not found.");
    }
}

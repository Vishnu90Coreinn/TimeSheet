using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Notifications.Commands;

public class ClearNotificationsCommandHandler(
    INotificationService notificationService,
    ICurrentUserService currentUser)
    : IRequestHandler<ClearNotificationsCommand, Result>
{
    public async Task<Result> Handle(ClearNotificationsCommand request, CancellationToken cancellationToken)
    {
        await notificationService.DeleteAllAsync(currentUser.UserId);
        return Result.Success();
    }
}

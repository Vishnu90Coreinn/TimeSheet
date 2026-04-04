using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Manager.Commands;

public class RemindUserCommandHandler(IManagerQueryService managerQueryService, ICurrentUserService currentUserService)
    : IRequestHandler<RemindUserCommand, Result>
{
    public async Task<Result> Handle(RemindUserCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty)
            return Result.Forbidden("Unauthorized.");

        var sent = await managerQueryService.SendReminderAsync(currentUserService.UserId, request.UserId, cancellationToken);
        return sent ? Result.Success() : Result.NotFound("User not found among your direct reports.");
    }
}

using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Anomalies.Commands;

public class DismissAnomalyCommandHandler(IAnomalyQueryService service, ICurrentUserService currentUserService)
    : IRequestHandler<DismissAnomalyCommand, Result>
{
    public async Task<Result> Handle(DismissAnomalyCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty)
            return Result.Forbidden("Unauthorized.");

        return await service.DismissAsync(request.NotificationId, currentUserService.UserId, cancellationToken)
            ? Result.Success()
            : Result.NotFound("Anomaly notification not found.");
    }
}

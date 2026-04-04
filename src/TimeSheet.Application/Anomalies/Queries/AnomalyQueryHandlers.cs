using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Anomalies.Queries;

public class GetAnomaliesQueryHandler(IAnomalyQueryService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetAnomaliesQuery, Result<IReadOnlyList<AnomalyNotificationResult>>>
{
    public async Task<Result<IReadOnlyList<AnomalyNotificationResult>>> Handle(GetAnomaliesQuery request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty)
            return Result<IReadOnlyList<AnomalyNotificationResult>>.Forbidden("Unauthorized.");

        return Result<IReadOnlyList<AnomalyNotificationResult>>.Success(
            await service.GetAnomaliesAsync(currentUserService.UserId, request.Severity, cancellationToken));
    }
}

using TimeSheet.Api.Application.Anomaly.Models;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.Anomaly.Services;

public interface IAnomalyService
{
    Task<(PagedResult<AnomalyNotificationResponse>? Data, OperationError? Error)> GetAnomaliesAsync(Guid userId, AnomalyListQuery query, CancellationToken cancellationToken);
    Task<OperationError?> DismissAsync(Guid userId, Guid id, CancellationToken cancellationToken);
}

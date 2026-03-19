using TimeSheet.Api.Application.Anomaly.Models;
using TimeSheet.Api.Application.Anomaly.Services;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.Anomaly.Handlers;

public interface IGetAnomaliesHandler
{
    Task<(PagedResult<AnomalyNotificationResponse>? Data, OperationError? Error)> HandleAsync(Guid userId, AnomalyListQuery query, CancellationToken cancellationToken);
}

public class GetAnomaliesHandler(IAnomalyService service) : IGetAnomaliesHandler
{
    public Task<(PagedResult<AnomalyNotificationResponse>? Data, OperationError? Error)> HandleAsync(Guid userId, AnomalyListQuery query, CancellationToken cancellationToken) =>
        service.GetAnomaliesAsync(userId, query, cancellationToken);
}

public interface IDismissAnomalyHandler
{
    Task<OperationError?> HandleAsync(Guid userId, Guid id, CancellationToken cancellationToken);
}

public class DismissAnomalyHandler(IAnomalyService service) : IDismissAnomalyHandler
{
    public Task<OperationError?> HandleAsync(Guid userId, Guid id, CancellationToken cancellationToken) =>
        service.DismissAsync(userId, id, cancellationToken);
}

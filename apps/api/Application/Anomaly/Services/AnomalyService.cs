using TimeSheet.Api.Application.Anomaly.Models;
using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.Anomaly;

namespace TimeSheet.Api.Application.Anomaly.Services;

public class AnomalyService(IAnomalyRepository repository) : IAnomalyService
{
    public async Task<(PagedResult<AnomalyNotificationResponse>? Data, OperationError? Error)> GetAnomaliesAsync(Guid userId, AnomalyListQuery query, CancellationToken cancellationToken)
    {
        var notifications = await repository.GetUnreadAnomaliesAsync(userId, cancellationToken);
        var mapped = notifications.Select(n => new AnomalyNotificationResponse(
            n.Id,
            n.Title,
            n.Message,
            InferSeverity(n.Title),
            DateTime.SpecifyKind(n.CreatedAtUtc, DateTimeKind.Utc).ToString("O")));

        if (!query.FetchAll && !string.IsNullOrWhiteSpace(query.Severity))
        {
            mapped = mapped.Where(r => r.Severity.Equals(query.Severity, StringComparison.OrdinalIgnoreCase));
        }

        var ordered = mapped.OrderByDescending(x => x.CreatedAtIsoUtc).ToList();
        var totalCount = ordered.Count;
        var items = query.FetchAll ? ordered : ordered.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize).ToList();

        return (new PagedResult<AnomalyNotificationResponse>(items, totalCount, query.FetchAll ? 1 : query.PageNumber, query.FetchAll ? totalCount : query.PageSize, query.FetchAll), null);
    }

    public async Task<OperationError?> DismissAsync(Guid userId, Guid id, CancellationToken cancellationToken)
    {
        var notification = await repository.GetAnomalyByIdAsync(userId, id, cancellationToken);
        if (notification is null)
        {
            return new OperationError(ErrorCodes.AnomalyNotFound, ApiMessages.AnomalyNotFound, StatusCodes.Status404NotFound);
        }

        notification.IsRead = true;
        await repository.SaveChangesAsync(cancellationToken);
        return null;
    }

    private static string InferSeverity(string title)
    {
        if (title.Contains("Critical", StringComparison.OrdinalIgnoreCase)
            || title.Equals("Compliance Dropped", StringComparison.OrdinalIgnoreCase))
            return "critical";
        return "warning";
    }
}

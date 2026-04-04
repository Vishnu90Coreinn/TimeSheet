using TimeSheet.Application.Anomalies.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface IAnomalyQueryService
{
    Task<IReadOnlyList<AnomalyNotificationResult>> GetAnomaliesAsync(Guid userId, string? severity, CancellationToken ct = default);
    Task<bool> DismissAsync(Guid notificationId, Guid userId, CancellationToken ct = default);
}

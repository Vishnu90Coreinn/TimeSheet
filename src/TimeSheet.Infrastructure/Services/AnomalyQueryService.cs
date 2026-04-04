using TimeSheet.Application.Anomalies.Queries;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class AnomalyQueryService(INotificationRepository notificationRepository, IUnitOfWork unitOfWork) : IAnomalyQueryService
{
    public async Task<IReadOnlyList<AnomalyNotificationResult>> GetAnomaliesAsync(Guid userId, string? severity, CancellationToken ct = default)
        => (await notificationRepository.GetUnreadAnomaliesByUserAsync(userId, severity, ct))
            .Select(n => new AnomalyNotificationResult(
                n.Id,
                n.Title,
                n.Message,
                InferSeverity(n.Title),
                DateTime.SpecifyKind(n.CreatedAtUtc, DateTimeKind.Utc).ToString("O")))
            .ToList();

    public async Task<bool> DismissAsync(Guid notificationId, Guid userId, CancellationToken ct = default)
    {
        var notification = await notificationRepository.GetAnomalyByIdAsync(notificationId, userId, ct);
        if (notification is null) return false;
        notification.IsRead = true;
        await unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    private static string InferSeverity(string title)
    {
        if (title.Contains("Critical", StringComparison.OrdinalIgnoreCase)
            || title.Equals("Compliance Dropped", StringComparison.OrdinalIgnoreCase))
            return "critical";
        return "warning";
    }
}

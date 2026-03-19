using TimeSheet.Api.Models;

namespace TimeSheet.Api.Infrastructure.Persistence.Repositories.Anomaly;

public interface IAnomalyRepository
{
    Task<IReadOnlyList<Notification>> GetUnreadAnomaliesAsync(Guid userId, CancellationToken cancellationToken);
    Task<Notification?> GetAnomalyByIdAsync(Guid userId, Guid id, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

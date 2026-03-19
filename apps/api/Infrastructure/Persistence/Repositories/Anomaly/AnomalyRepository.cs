using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Infrastructure.Persistence.Repositories.Anomaly;

public class AnomalyRepository(TimeSheetDbContext dbContext) : IAnomalyRepository
{
    public async Task<IReadOnlyList<Notification>> GetUnreadAnomaliesAsync(Guid userId, CancellationToken cancellationToken)
    {
        return await dbContext.Notifications
            .Where(n => n.UserId == userId && n.Type == NotificationType.Anomaly && !n.IsRead)
            .OrderByDescending(n => n.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<Notification?> GetAnomalyByIdAsync(Guid userId, Guid id, CancellationToken cancellationToken)
        => dbContext.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId && n.Type == NotificationType.Anomaly, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => dbContext.SaveChangesAsync(cancellationToken);
}

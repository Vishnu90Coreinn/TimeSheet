using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class NotificationRepository(TimeSheetDbContext context) : INotificationRepository
{
    private readonly DbSet<Notification> _dbSet = context.Set<Notification>();

    public async Task<IReadOnlyList<Notification>> GetUnreadByUserAsync(Guid userId, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Where(n => n.UserId == userId && !n.IsRead)
            .OrderByDescending(n => n.CreatedAtUtc)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Notification>> GetUnreadAnomaliesByUserAsync(Guid userId, string? severity = null, CancellationToken ct = default)
    {
        var query = _dbSet
            .AsNoTracking()
            .Where(n => n.UserId == userId && !n.IsRead && n.Type == NotificationType.Anomaly);

        if (!string.IsNullOrWhiteSpace(severity))
        {
            var normalized = severity.Trim();
            if (normalized.Equals("critical", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(n =>
                    n.Title.Contains("Critical") ||
                    n.Title == "Compliance Dropped");
            }
            else if (normalized.Equals("warning", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(n =>
                    !n.Title.Contains("Critical") &&
                    n.Title != "Compliance Dropped");
            }
        }

        return await query
            .OrderByDescending(n => n.CreatedAtUtc)
            .ToListAsync(ct);
    }

    public async Task<Notification?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(n => n.Id == id, ct);

    public async Task<Notification?> GetAnomalyByIdAsync(Guid id, Guid userId, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(
            n => n.Id == id && n.UserId == userId && n.Type == NotificationType.Anomaly,
            ct);

    public async Task<IReadOnlyList<Notification>> GetByUserAsync(Guid userId, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAtUtc)
            .ThenByDescending(n => n.Id)
            .ToListAsync(ct);

    public async Task<(IReadOnlyList<Notification> Items, bool HasMore)> GetPageByUserAsync(Guid userId, int page, int pageSize, CancellationToken ct = default)
    {
        var items = await _dbSet
            .AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAtUtc)
            .ThenByDescending(n => n.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize + 1)
            .ToListAsync(ct);

        var hasMore = items.Count > pageSize;
        if (hasMore)
            items = items.Take(pageSize).ToList();

        return (items, hasMore);
    }

    public Task<int> CountUnreadByUserAsync(Guid userId, CancellationToken ct = default)
        => _dbSet.CountAsync(n => n.UserId == userId && !n.IsRead, ct);

    public async Task<IReadOnlyList<Notification>> GetAllByUserAsync(Guid userId, CancellationToken ct = default)
        => await _dbSet
            .Where(n => n.UserId == userId)
            .ToListAsync(ct);

    public void Add(Notification notification) => _dbSet.Add(notification);

    public void Remove(Notification notification) => _dbSet.Remove(notification);

    public void RemoveRange(IEnumerable<Notification> notifications) => _dbSet.RemoveRange(notifications);
}

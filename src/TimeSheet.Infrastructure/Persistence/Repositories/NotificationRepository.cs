using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
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

    public async Task<Notification?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(n => n.Id == id, ct);

    public void Add(Notification notification) => _dbSet.Add(notification);
}

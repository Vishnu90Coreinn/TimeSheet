using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class SavedReportRepository(TimeSheetDbContext context) : ISavedReportRepository
{
    private readonly DbSet<SavedReport> _dbSet = context.Set<SavedReport>();

    public async Task<IReadOnlyList<SavedReport>> GetByUserAsync(Guid userId, CancellationToken ct = default)
        => await _dbSet.AsNoTracking().Where(r => r.UserId == userId).OrderBy(r => r.Name).ToListAsync(ct);

    public async Task<SavedReport?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(r => r.Id == id, ct);

    public void Add(SavedReport report) => _dbSet.Add(report);
    public void Remove(SavedReport report) => _dbSet.Remove(report);
}

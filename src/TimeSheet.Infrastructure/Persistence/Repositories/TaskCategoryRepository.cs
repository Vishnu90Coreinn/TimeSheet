using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class TaskCategoryRepository(TimeSheetDbContext context) : ITaskCategoryRepository
{
    private readonly DbSet<TaskCategory> _dbSet = context.Set<TaskCategory>();

    public async Task<IReadOnlyList<TaskCategory>> GetActiveAsync(CancellationToken ct = default)
        => await _dbSet.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.Name).ToListAsync(ct);

    public async Task<IReadOnlyList<TaskCategory>> GetAllAsync(CancellationToken ct = default)
        => await _dbSet.AsNoTracking().OrderBy(c => c.Name).ToListAsync(ct);

    public async Task<bool> ExistsAsync(string name, Guid? excludeId = null, CancellationToken ct = default)
        => await _dbSet.AnyAsync(c => c.Name == name && (excludeId == null || c.Id != excludeId), ct);

    public async Task<TaskCategory?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(c => c.Id == id, ct);

    public void Add(TaskCategory category) => _dbSet.Add(category);

    public void Remove(TaskCategory category) => _dbSet.Remove(category);
}

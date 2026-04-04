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

    public async Task<(IReadOnlyList<TaskCategory> Items, int TotalCount, int Page)> GetPagedAsync(
        string? search,
        bool? isActive,
        bool? isBillable,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _dbSet.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(c => c.Name.Contains(term));
        }

        if (isActive.HasValue)
            query = query.Where(c => c.IsActive == isActive.Value);

        if (isBillable.HasValue)
            query = query.Where(c => c.IsBillable == isBillable.Value);

        query = sortBy switch
        {
            "isactive" => descending ? query.OrderByDescending(c => c.IsActive) : query.OrderBy(c => c.IsActive),
            "isbillable" => descending ? query.OrderByDescending(c => c.IsBillable) : query.OrderBy(c => c.IsBillable),
            _ => descending ? query.OrderByDescending(c => c.Name) : query.OrderBy(c => c.Name),
        };

        var totalCount = await query.CountAsync(ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        var safePage = page > totalPages ? totalPages : page;
        var items = await query.Skip((safePage - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return (items, totalCount, safePage);
    }

    public void Add(TaskCategory category) => _dbSet.Add(category);

    public void Remove(TaskCategory category) => _dbSet.Remove(category);
}

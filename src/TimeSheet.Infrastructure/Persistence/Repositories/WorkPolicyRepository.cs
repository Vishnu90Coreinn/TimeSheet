using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class WorkPolicyRepository(TimeSheetDbContext context) : IWorkPolicyRepository
{
    private readonly DbSet<WorkPolicy> _dbSet = context.Set<WorkPolicy>();

    public async Task<IReadOnlyList<WorkPolicy>> GetAllAsync(CancellationToken ct = default)
        => await _dbSet.AsNoTracking().OrderBy(w => w.Name).ToListAsync(ct);

    public async Task<WorkPolicy?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(w => w.Id == id, ct);

    public async Task<(IReadOnlyList<WorkPolicy> Items, int TotalCount, int Page)> GetPagedAsync(
        string? search,
        bool? isActive,
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
            query = query.Where(w => w.Name.Contains(term));
        }

        if (isActive.HasValue)
            query = query.Where(w => w.IsActive == isActive.Value);

        query = sortBy switch
        {
            "dailyexpectedminutes" => descending ? query.OrderByDescending(w => w.DailyExpectedMinutes) : query.OrderBy(w => w.DailyExpectedMinutes),
            "workdaysperweek" => descending ? query.OrderByDescending(w => w.WorkDaysPerWeek) : query.OrderBy(w => w.WorkDaysPerWeek),
            "isactive" => descending ? query.OrderByDescending(w => w.IsActive) : query.OrderBy(w => w.IsActive),
            _ => descending ? query.OrderByDescending(w => w.Name) : query.OrderBy(w => w.Name),
        };

        var totalCount = await query.CountAsync(ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        var safePage = page > totalPages ? totalPages : page;
        var items = await query.Skip((safePage - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return (items, totalCount, safePage);
    }

    public async Task<bool> ExistsAsync(string name, Guid? excludeId = null, CancellationToken ct = default)
        => await _dbSet.AnyAsync(w => w.Name == name && (excludeId == null || w.Id != excludeId), ct);

    public void Add(WorkPolicy policy) => _dbSet.Add(policy);

    public void Remove(WorkPolicy policy) => _dbSet.Remove(policy);
}

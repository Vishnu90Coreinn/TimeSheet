using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class LeavePolicyRepository(TimeSheetDbContext context) : ILeavePolicyRepository
{
    private readonly DbSet<LeavePolicy> _dbSet = context.Set<LeavePolicy>();

    public async Task<LeavePolicy?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<LeavePolicy?> GetByIdWithAllocationsAsync(Guid id, CancellationToken ct = default)
        => await _dbSet
            .Include(p => p.Allocations)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<IReadOnlyList<LeavePolicy>> GetAllAsync(CancellationToken ct = default)
        => await _dbSet
            .Include(p => p.Allocations)
                .ThenInclude(a => a.LeaveType)
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

    public void Add(LeavePolicy leavePolicy) => _dbSet.Add(leavePolicy);

    public void Update(LeavePolicy leavePolicy) => _dbSet.Update(leavePolicy);

    public void Remove(LeavePolicy leavePolicy) => _dbSet.Remove(leavePolicy);

    public void RemoveAllocations(IEnumerable<LeavePolicyAllocation> allocations)
        => context.LeavePolicyAllocations.RemoveRange(allocations);

    public async Task<(IReadOnlyList<PagedLeavePolicyRow> Items, int TotalCount, int Page)> GetPagedAsync(
        string? search,
        bool? isActive,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _dbSet
            .AsNoTracking()
            .Include(p => p.Allocations)
            .ThenInclude(a => a.LeaveType)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(p => p.Name.Contains(term));
        }

        if (isActive.HasValue)
            query = query.Where(p => p.IsActive == isActive.Value);

        sortBy = (sortBy ?? "name").Trim().ToLowerInvariant();
        query = sortBy switch
        {
            "isactive" => descending ? query.OrderByDescending(p => p.IsActive) : query.OrderBy(p => p.IsActive),
            _ => descending ? query.OrderByDescending(p => p.Name) : query.OrderBy(p => p.Name),
        };

        var totalCount = await query.CountAsync(ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        var safePage = page > totalPages ? totalPages : page;

        var items = await query
            .Skip((safePage - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PagedLeavePolicyRow(
                p.Id,
                p.Name,
                p.IsActive,
                p.Allocations
                    .Select(a => new PagedLeavePolicyAllocationRow(a.LeaveTypeId, a.LeaveType.Name, a.DaysPerYear))
                    .ToList()))
            .ToListAsync(ct);

        return (items, totalCount, safePage);
    }
}

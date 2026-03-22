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
}

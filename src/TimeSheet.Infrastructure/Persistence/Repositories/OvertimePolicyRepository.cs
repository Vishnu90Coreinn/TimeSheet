using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class OvertimePolicyRepository(TimeSheetDbContext context) : IOvertimePolicyRepository
{
    private readonly DbSet<OvertimePolicy> _dbSet = context.Set<OvertimePolicy>();

    public async Task<OvertimePolicy?> GetByWorkPolicyIdAsync(Guid workPolicyId, CancellationToken ct = default)
        => await _dbSet.SingleOrDefaultAsync(x => x.WorkPolicyId == workPolicyId, ct);

    public async Task<IReadOnlyDictionary<Guid, OvertimePolicy>> GetByWorkPolicyIdsAsync(IEnumerable<Guid> workPolicyIds, CancellationToken ct = default)
    {
        var ids = workPolicyIds.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, OvertimePolicy>();

        return await _dbSet
            .Where(x => ids.Contains(x.WorkPolicyId))
            .ToDictionaryAsync(x => x.WorkPolicyId, ct);
    }

    public void Add(OvertimePolicy policy) => _dbSet.Add(policy);
}


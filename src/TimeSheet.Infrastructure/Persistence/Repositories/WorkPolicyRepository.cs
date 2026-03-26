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

    public async Task<bool> ExistsAsync(string name, Guid? excludeId = null, CancellationToken ct = default)
        => await _dbSet.AnyAsync(w => w.Name == name && (excludeId == null || w.Id != excludeId), ct);

    public void Add(WorkPolicy policy) => _dbSet.Add(policy);

    public void Remove(WorkPolicy policy) => _dbSet.Remove(policy);
}

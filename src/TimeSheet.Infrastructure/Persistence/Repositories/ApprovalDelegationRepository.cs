using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class ApprovalDelegationRepository(TimeSheetDbContext context) : IApprovalDelegationRepository
{
    private readonly DbSet<ApprovalDelegation> _dbSet = context.Set<ApprovalDelegation>();

    public async Task<ApprovalDelegation?> GetActiveForUserAsync(Guid fromUserId, CancellationToken ct = default)
        => await _dbSet
            .Include(d => d.FromUser)
            .Include(d => d.ToUser)
            .FirstOrDefaultAsync(d => d.FromUserId == fromUserId && d.IsActive, ct);

    public async Task<IReadOnlyList<ApprovalDelegation>> GetActiveDelegationsForDelegateAsync(Guid toUserId, CancellationToken ct = default)
        => await _dbSet
            .Include(d => d.FromUser)
            .Include(d => d.ToUser)
            .Where(d => d.ToUserId == toUserId && d.IsActive)
            .ToListAsync(ct);

    public async Task<ApprovalDelegation?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(d => d.Id == id, ct);

    public async Task<bool> HasOverlapAsync(Guid fromUserId, DateOnly fromDate, DateOnly toDate, CancellationToken ct = default)
        => await _dbSet.AnyAsync(d =>
            d.FromUserId == fromUserId &&
            d.IsActive &&
            d.FromDate <= toDate &&
            d.ToDate >= fromDate, ct);

    public void Add(ApprovalDelegation delegation) => _dbSet.Add(delegation);
}

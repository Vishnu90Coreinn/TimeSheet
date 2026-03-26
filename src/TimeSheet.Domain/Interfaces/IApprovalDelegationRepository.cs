using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IApprovalDelegationRepository
{
    Task<ApprovalDelegation?> GetActiveForUserAsync(Guid fromUserId, CancellationToken ct = default);
    Task<IReadOnlyList<ApprovalDelegation>> GetActiveDelegationsForDelegateAsync(Guid toUserId, CancellationToken ct = default);
    Task<ApprovalDelegation?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> HasOverlapAsync(Guid fromUserId, DateOnly fromDate, DateOnly toDate, CancellationToken ct = default);
    void Add(ApprovalDelegation delegation);
}

using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface ILeavePolicyRepository
{
    Task<LeavePolicy?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<LeavePolicy?> GetByIdWithAllocationsAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<LeavePolicy>> GetAllAsync(CancellationToken ct = default);
    void Add(LeavePolicy leavePolicy);
    void Update(LeavePolicy leavePolicy);
    void Remove(LeavePolicy leavePolicy);
    void RemoveAllocations(IEnumerable<LeavePolicyAllocation> allocations);
}

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
    Task<(IReadOnlyList<PagedLeavePolicyRow> Items, int TotalCount, int Page)> GetPagedAsync(
        string? search,
        bool? isActive,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);
}

public record PagedLeavePolicyRow(
    Guid Id,
    string Name,
    bool IsActive,
    List<PagedLeavePolicyAllocationRow> Allocations);

public record PagedLeavePolicyAllocationRow(
    Guid LeaveTypeId,
    string LeaveTypeName,
    int DaysPerYear);

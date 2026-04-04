namespace TimeSheet.Domain.Interfaces;

public interface ILeaveReadRepository
{
    Task<IReadOnlyList<LeaveTypeReadRow>> GetLeaveTypesAsync(bool activeOnly, CancellationToken ct = default);
    Task<IReadOnlyList<PagedLeaveRequestRow>> GetMyRequestsAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<LeaveGroupReadRow>> GetMyGroupedRequestsAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<LeaveBalanceReadRow>> GetBalancesAsync(Guid userId, int year, CancellationToken ct = default);
    Task<IReadOnlyList<LeavePolicyReadRow>> GetPoliciesAsync(CancellationToken ct = default);
    Task<IReadOnlyList<PagedLeaveRequestRow>> GetPendingForManagerAsync(Guid managerId, bool isAdmin, CancellationToken ct = default);
}

public record LeaveTypeReadRow(Guid Id, string Name, bool IsActive);
public record LeaveGroupReadRow(Guid GroupId, string LeaveTypeName, DateOnly FromDate, DateOnly ToDate, int Days, string Status, DateOnly AppliedOnDate, string? ApprovedByUsername, string? Comment);
public record LeaveBalanceReadRow(Guid LeaveTypeId, string LeaveTypeName, int TotalDays, int UsedDays, int RemainingDays);
public record LeavePolicyReadRow(Guid Id, string Name, bool IsActive, IReadOnlyList<PagedLeavePolicyAllocationRow> Allocations);

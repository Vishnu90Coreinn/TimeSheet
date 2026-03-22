namespace TimeSheet.Application.Common.Interfaces;

/// <summary>
/// Read-side service providing EF-backed queries for leave handlers and query handlers.
/// Implemented in Infrastructure; Application layer depends only on this interface.
/// </summary>
public interface ILeaveQueryService
{
    Task<List<LeaveTypeResult>> GetLeaveTypesAsync(bool activeOnly, CancellationToken ct = default);
    Task<List<LeaveRequestResult>> GetMyRequestsAsync(Guid userId, CancellationToken ct = default);
    Task<List<LeaveGroupResult>> GetMyGroupedRequestsAsync(Guid userId, CancellationToken ct = default);
    Task<List<LeaveBalanceResult>> GetBalanceAsync(Guid userId, int year, CancellationToken ct = default);
    Task<List<LeavePolicyResult>> GetPoliciesAsync(CancellationToken ct = default);
    Task<List<LeaveRequestResult>> GetPendingForManagerAsync(Guid managerId, bool isAdmin, CancellationToken ct = default);
}

// ── Response records ─────────────────────────────────────────────────────────

public record LeaveTypeResult(
    Guid Id,
    string Name,
    bool IsActive);

public record LeaveRequestResult(
    Guid Id,
    Guid UserId,
    string Username,
    DateOnly LeaveDate,
    Guid LeaveTypeId,
    string LeaveTypeName,
    bool IsHalfDay,
    string Status,
    string? Comment,
    Guid? ReviewedByUserId,
    string? ReviewedByUsername,
    string? ReviewerComment,
    DateTime CreatedAtUtc,
    DateTime? ReviewedAtUtc);

public record LeaveGroupResult(
    Guid GroupId,
    string LeaveTypeName,
    DateOnly FromDate,
    DateOnly ToDate,
    int Days,
    string Status,
    DateOnly AppliedOnDate,
    string? ApprovedByUsername,
    string? Comment);

public record LeaveBalanceResult(
    Guid LeaveTypeId,
    string LeaveTypeName,
    int TotalDays,
    int UsedDays,
    int RemainingDays);

public record LeavePolicyAllocationResult(
    Guid LeaveTypeId,
    string LeaveTypeName,
    int DaysPerYear);

public record LeavePolicyResult(
    Guid Id,
    string Name,
    bool IsActive,
    List<LeavePolicyAllocationResult> Allocations);

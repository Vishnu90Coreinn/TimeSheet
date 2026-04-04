namespace TimeSheet.Application.Common.Interfaces;

using TimeSheet.Application.Common.Models;

/// <summary>
/// Read-side service providing EF-backed queries for leave handlers and query handlers.
/// Implemented in Infrastructure; Application layer depends only on this interface.
/// </summary>
public interface ILeaveQueryService
{
    Task<List<LeaveTypeResult>> GetLeaveTypesAsync(bool activeOnly, CancellationToken ct = default);
    Task<List<LeaveRequestResult>> GetMyRequestsAsync(Guid userId, CancellationToken ct = default);
    Task<PagedResult<LeaveRequestResult>> GetMyRequestsPageAsync(
        Guid userId,
        string? search,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<List<LeaveGroupResult>> GetMyGroupedRequestsAsync(Guid userId, CancellationToken ct = default);
    Task<List<LeaveBalanceResult>> GetBalanceAsync(Guid userId, int year, CancellationToken ct = default);
    Task<List<LeavePolicyResult>> GetPoliciesAsync(CancellationToken ct = default);
    Task<PagedResult<LeavePolicyResult>> GetPoliciesPageAsync(
        string? search,
        bool? isActive,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<List<LeaveRequestResult>> GetPendingForManagerAsync(Guid managerId, bool isAdmin, CancellationToken ct = default);
    Task<PagedResult<LeaveRequestResult>> GetPendingForManagerPageAsync(
        Guid managerId,
        bool isAdmin,
        string? search,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<IReadOnlyList<LeaveCalendarDayResult>> GetCalendarAsync(Guid userId, int year, int month, CancellationToken ct = default);
    Task<IReadOnlyList<TeamLeaveCalendarDayResult>> GetTeamCalendarAsync(Guid userId, string role, int year, int month, CancellationToken ct = default);
    Task<LeaveConflictResult> GetConflictsAsync(Guid currentUserId, string role, DateOnly fromDate, DateOnly toDate, Guid? targetUserId, CancellationToken ct = default);
    Task<IReadOnlyList<TeamOnLeaveResult>> GetTeamOnLeaveAsync(Guid userId, CancellationToken ct = default);
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

public record LeaveCalendarDayResult(DateOnly Date, string Type);
public record TeamLeaveEntryResult(Guid UserId, string Username, string DisplayName, string LeaveTypeName, string Status);
public record TeamLeaveCalendarDayResult(DateOnly Date, IReadOnlyList<TeamLeaveEntryResult> Entries);
public record LeaveConflictResult(int ConflictingCount, IReadOnlyList<string> ConflictingUsernames);
public record TeamOnLeaveResult(Guid UserId, string Username, DateOnly FromDate, DateOnly ToDate, string LeaveTypeName, string Status);

using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface ILeaveRepository
{
    Task<LeaveRequest?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<LeaveRequest>> GetByIdOrGroupIdAsync(Guid idOrGroupId, CancellationToken ct = default);
    Task<IReadOnlyList<LeaveRequest>> GetPendingForManagerAsync(Guid managerId, CancellationToken ct = default);
    Task<IReadOnlyList<LeaveRequest>> GetByUserAsync(Guid userId, CancellationToken ct = default);
    Task<LeaveBalance?> GetBalanceAsync(Guid userId, Guid leaveTypeId, int year, CancellationToken ct = default);
    void Add(LeaveRequest leaveRequest);
    void AddRange(IEnumerable<LeaveRequest> leaveRequests);
    void RemoveRange(IEnumerable<LeaveRequest> leaveRequests);
    Task<IReadOnlyList<DateOnly>> GetActiveDatesAsync(Guid userId, IReadOnlyList<DateOnly> dates, CancellationToken ct = default);
    Task<IReadOnlyList<LeaveRequest>> GetRejectedForDatesAsync(Guid userId, IReadOnlyList<DateOnly> dates, CancellationToken ct = default);
    void AddBalance(LeaveBalance balance);
    Task<(IReadOnlyList<PagedLeaveRequestRow> Items, int TotalCount, int Page)> GetUserRequestsPageAsync(
        Guid userId,
        string? search,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<(IReadOnlyList<PagedLeaveRequestRow> Items, int TotalCount, int Page)> GetPendingForManagerPageAsync(
        Guid managerId,
        bool isAdmin,
        string? search,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<IReadOnlyList<LeaveCalendarRow>> GetCalendarAsync(Guid userId, int year, int month, CancellationToken ct = default);
    Task<IReadOnlyList<TeamLeaveCalendarRow>> GetTeamCalendarAsync(Guid userId, string role, int year, int month, CancellationToken ct = default);
    Task<LeaveConflictRow> GetConflictsAsync(Guid currentUserId, string role, DateOnly fromDate, DateOnly toDate, Guid? targetUserId, CancellationToken ct = default);
    Task<IReadOnlyList<TeamOnLeaveRow>> GetTeamOnLeaveAsync(Guid userId, DateOnly today, DateOnly windowEnd, CancellationToken ct = default);
}

public record PagedLeaveRequestRow(
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

public record LeaveCalendarRow(DateOnly Date, string Type);
public record TeamLeaveEntryRow(Guid UserId, string Username, string DisplayName, string LeaveTypeName, string Status);
public record TeamLeaveCalendarRow(DateOnly Date, IReadOnlyList<TeamLeaveEntryRow> Entries);
public record LeaveConflictRow(int ConflictingCount, IReadOnlyList<string> ConflictingUsernames);
public record TeamOnLeaveRow(Guid UserId, string Username, DateOnly FromDate, DateOnly ToDate, string LeaveTypeName, string Status);

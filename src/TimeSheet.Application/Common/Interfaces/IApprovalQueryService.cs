namespace TimeSheet.Application.Common.Interfaces;

using TimeSheet.Application.Common.Models;

public interface IApprovalQueryService
{
    Task<Guid?> GetTimesheetOwnerAsync(Guid timesheetId, CancellationToken ct = default);
    Task<List<ApprovalActionResult>> GetHistoryAsync(Guid timesheetId, CancellationToken ct = default);
    Task<ApprovalStatsResult> GetStatsAsync(Guid managerId, DateTime fromUtc, DateTime toUtc, CancellationToken ct = default);
    Task<PagedResult<PendingApprovalTimesheetResult>> GetPendingTimesheetsPageAsync(
        Guid managerId,
        string? search,
        bool? hasMismatch,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);
}

public record ApprovalActionResult(
    Guid Id,
    Guid TimesheetId,
    Guid ManagerUserId,
    string? ManagerUsername,
    string Action,
    string? Comment,
    DateTime ActionedAtUtc);

public record ApprovalStatsResult(
    int ApprovedThisMonth,
    int RejectedThisMonth,
    double? AvgResponseHours);

public record PendingApprovalTimesheetResult(
    Guid TimesheetId,
    Guid UserId,
    string Username,
    string DisplayName,
    DateOnly WorkDate,
    int EnteredMinutes,
    string Status,
    DateTime? SubmittedAtUtc,
    bool HasMismatch,
    string? MismatchReason,
    string? DelegatedFromUsername);

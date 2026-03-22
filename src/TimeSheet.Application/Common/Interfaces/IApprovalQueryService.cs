namespace TimeSheet.Application.Common.Interfaces;

public interface IApprovalQueryService
{
    Task<Guid?> GetTimesheetOwnerAsync(Guid timesheetId, CancellationToken ct = default);
    Task<List<ApprovalActionResult>> GetHistoryAsync(Guid timesheetId, CancellationToken ct = default);
    Task<ApprovalStatsResult> GetStatsAsync(Guid managerId, CancellationToken ct = default);
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

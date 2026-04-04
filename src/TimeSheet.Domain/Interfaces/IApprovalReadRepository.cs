namespace TimeSheet.Domain.Interfaces;

public interface IApprovalReadRepository
{
    Task<Guid?> GetTimesheetOwnerAsync(Guid timesheetId, CancellationToken ct = default);
    Task<IReadOnlyList<ApprovalHistoryRow>> GetHistoryAsync(Guid timesheetId, CancellationToken ct = default);
    Task<ApprovalStatsRow> GetStatsAsync(Guid managerId, DateTime fromUtc, DateTime toUtc, CancellationToken ct = default);
}

public record ApprovalHistoryRow(
    Guid Id,
    Guid TimesheetId,
    Guid ManagerUserId,
    string? ManagerUsername,
    string Action,
    string? Comment,
    DateTime ActionedAtUtc);

public record ApprovalStatsRow(int ApprovedThisMonth, int RejectedThisMonth, double? AvgResponseHours);

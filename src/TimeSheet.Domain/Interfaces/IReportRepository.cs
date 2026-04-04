namespace TimeSheet.Domain.Interfaces;

public interface IReportRepository
{
    Task<List<Guid>> GetScopedUserIdsAsync(
        Guid requesterUserId,
        string requesterRole,
        Guid? filterUserId,
        Guid? departmentId,
        CancellationToken ct = default);

    Task<(IReadOnlyList<AttendanceSummaryReportRow> Items, int TotalCount, int Page)> GetAttendanceSummaryPageAsync(
        IReadOnlyCollection<Guid> userIds,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<(IReadOnlyList<TimesheetSummaryReportRow> Items, int TotalCount, int Page)> GetTimesheetSummaryPageAsync(
        IReadOnlyCollection<Guid> userIds,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<(IReadOnlyList<ProjectEffortReportRow> Items, int TotalCount, int Page)> GetProjectEffortPageAsync(
        IReadOnlyCollection<Guid> userIds,
        DateOnly? fromDate,
        DateOnly? toDate,
        Guid? projectId,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<(IReadOnlyList<LeaveUtilizationReportRow> Items, int TotalCount, int Page)> GetLeaveUtilizationPageAsync(
        IReadOnlyCollection<Guid> userIds,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<(IReadOnlyList<LeaveBalanceReportRow> Items, int TotalCount, int Page)> GetLeaveBalancePageAsync(
        IReadOnlyCollection<Guid> userIds,
        int year,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<(IReadOnlyList<TimesheetApprovalStatusReportRow> Items, int TotalCount, int Page)> GetTimesheetApprovalStatusPageAsync(
        IReadOnlyCollection<Guid> userIds,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<(IReadOnlyList<OvertimeDeficitReportRow> Items, int TotalCount, int Page)> GetOvertimeDeficitPageAsync(
        IReadOnlyCollection<Guid> userIds,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken ct = default);
}

public record AttendanceSummaryReportRow(
    Guid UserId,
    string Username,
    DateOnly WorkDate,
    int AttendanceMinutes,
    int BreakMinutes,
    bool HasException);

public record TimesheetSummaryReportRow(
    Guid UserId,
    string Username,
    DateOnly WorkDate,
    string Status,
    int EnteredMinutes,
    int AttendanceMinutes,
    bool HasMismatch);

public record ProjectEffortReportRow(
    Guid ProjectId,
    string ProjectName,
    string ProjectCode,
    int TotalMinutes,
    int DistinctContributors);

public record LeaveUtilizationReportRow(
    Guid UserId,
    string Username,
    int LeaveDays,
    int HalfDays,
    int TimesheetMinutes,
    decimal UtilizationPercent);

public record LeaveBalanceReportRow(
    Guid UserId,
    string Username,
    string LeaveTypeName,
    int AllocatedDays,
    int UsedDays,
    int RemainingDays);

public record TimesheetApprovalStatusReportRow(
    Guid UserId,
    string Username,
    DateOnly WorkDate,
    int EnteredMinutes,
    string Status,
    string? ApprovedByUsername,
    DateTime? ApprovedAtUtc);

public record OvertimeDeficitReportRow(
    Guid UserId,
    string Username,
    DateOnly WeekStart,
    int TargetMinutes,
    int LoggedMinutes,
    int DeltaMinutes);

using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Reports.Queries;

public record AttendanceSummaryReportResult(
    Guid UserId,
    string Username,
    DateOnly WorkDate,
    int AttendanceMinutes,
    int BreakMinutes,
    bool HasException);

public record TimesheetSummaryReportResult(
    Guid UserId,
    string Username,
    DateOnly WorkDate,
    string Status,
    int EnteredMinutes,
    int AttendanceMinutes,
    bool HasMismatch);

public record ProjectEffortReportResult(
    Guid ProjectId,
    string ProjectName,
    string ProjectCode,
    int TotalMinutes,
    int DistinctContributors);

public record LeaveUtilizationReportResult(
    Guid UserId,
    string Username,
    int LeaveDays,
    int HalfDays,
    int TimesheetMinutes,
    decimal UtilizationPercent);

public record LeaveBalanceReportResult(
    Guid UserId,
    string Username,
    string LeaveTypeName,
    int AllocatedDays,
    int UsedDays,
    int RemainingDays);

public record TimesheetApprovalStatusReportResult(
    Guid UserId,
    string Username,
    DateOnly WorkDate,
    int EnteredMinutes,
    string Status,
    string? ApprovedByUsername,
    DateTime? ApprovedAtUtc);

public record OvertimeDeficitReportResult(
    Guid UserId,
    string Username,
    DateOnly WeekStart,
    int TargetMinutes,
    int LoggedMinutes,
    int DeltaMinutes);

public record ReportExportResult(
    string[] Headers,
    List<string[]> Rows,
    string FileName);

public record ReportFilterModel(
    DateOnly? FromDate,
    DateOnly? ToDate,
    Guid? UserId,
    Guid? DepartmentId,
    Guid? ProjectId,
    int Page,
    int PageSize);

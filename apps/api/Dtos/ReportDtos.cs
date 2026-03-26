using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record ReportFilterRequest(
    DateOnly? FromDate,
    DateOnly? ToDate,
    Guid? UserId,
    Guid? DepartmentId,
    Guid? ProjectId,
    [Range(1, 200)] int Page = 1,
    [Range(1, 200)] int PageSize = 25);

public record PagedReportResponse<T>(
    int Page,
    int PageSize,
    int Total,
    IReadOnlyCollection<T> Items);

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

public record EmployeeDashboardResponse(
    object TodaySession,
    object TodayTimesheet,
    object WeeklyHours,
    IReadOnlyCollection<object> ProjectEffort,
    IReadOnlyCollection<object> MonthlyComplianceTrend);

public record ManagerDashboardResponse(
    object TeamAttendance,
    object TimesheetHealth,
    IReadOnlyCollection<object> Mismatches,
    object Utilization,
    IReadOnlyCollection<object> Contributions);

public record ManagementDashboardResponse(
    IReadOnlyCollection<object> EffortByDepartment,
    IReadOnlyCollection<object> EffortByProject,
    object Billable,
    object ConsultantVsInternal,
    IReadOnlyCollection<object> UnderOver,
    IReadOnlyCollection<object> Compliance);

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

public record SavedReportRequest(
    string Name,
    string ReportKey,
    string FiltersJson,
    string ScheduleType,
    DayOfWeek? ScheduleDayOfWeek,
    int ScheduleHour,
    List<string> RecipientEmails
);

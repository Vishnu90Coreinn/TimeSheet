namespace TimeSheet.Api.Dtos;

public record ReportFilterRequest(
    DateOnly? FromDate,
    DateOnly? ToDate,
    Guid? UserId,
    Guid? DepartmentId,
    Guid? ProjectId,
    int Page = 1,
    int PageSize = 25);

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
    object TodayAttendance,
    object TimesheetStatus,
    object WeeklyHours,
    IReadOnlyCollection<object> ProjectEffort,
    IReadOnlyCollection<object> MonthlyComplianceTrend);

public record ManagerDashboardResponse(
    object TeamPresence,
    object MissingTimesheets,
    IReadOnlyCollection<object> AttendanceTimesheetMismatch,
    object TeamUtilization,
    IReadOnlyCollection<object> TeamProjectContribution);

public record ManagementDashboardResponse(
    IReadOnlyCollection<object> EffortByDepartment,
    IReadOnlyCollection<object> EffortByProject,
    object BillableVsNonBillable,
    object ConsultantVsInternal,
    IReadOnlyCollection<object> UnderOverUtilized,
    IReadOnlyCollection<object> ComplianceTrend);

namespace TimeSheet.Application.Dashboard.Queries;

public record EmployeeTodaySessionResult(DateOnly WorkDate, DateTime? CheckedIn, DateTime? CheckedOut, int BreakMinutes, int AttendanceMinutes);
public record EmployeeTodayTimesheetResult(string Status, string? MismatchReason, int EnteredMinutes, int PendingActions);
public record EmployeeWeeklyHoursResult(int Entered, int Breaks);
public record EmployeeProjectEffortResult(string Project, int Minutes);
public record EmployeeComplianceTrendResult(DateOnly WorkDate, bool IsCompliant);
public record EmployeeDashboardResult(
    EmployeeTodaySessionResult TodaySession,
    EmployeeTodayTimesheetResult TodayTimesheet,
    EmployeeWeeklyHoursResult WeeklyHours,
    IReadOnlyCollection<EmployeeProjectEffortResult> ProjectEffort,
    IReadOnlyCollection<EmployeeComplianceTrendResult> MonthlyComplianceTrend);

public record ManagerTeamAttendanceResult(int Present, int OnLeave, int NotCheckedIn);
public record ManagerTimesheetHealthResult(int Missing, int PendingApprovals);
public record ManagerMismatchResult(string Username, DateOnly WorkDate, string? MismatchReason);
public record ManagerUtilizationResult(double AvgMinutes);
public record ManagerContributionResult(string Project, int Minutes);
public record ManagerDashboardResult(
    ManagerTeamAttendanceResult TeamAttendance,
    ManagerTimesheetHealthResult TimesheetHealth,
    IReadOnlyCollection<ManagerMismatchResult> Mismatches,
    ManagerUtilizationResult Utilization,
    IReadOnlyCollection<ManagerContributionResult> Contributions);

public record ManagementEffortByDepartmentResult(string Department, int Minutes);
public record ManagementEffortByProjectResult(string Project, int Minutes);
public record ManagementBillableResult(int BillableMinutes, int NonBillableMinutes);
public record ManagementConsultantVsInternalResult(int Consultant, int Internal);
public record ManagementUnderOverResult(string Username, string Status, int Minutes);
public record ManagementComplianceResult(DateOnly WorkDate, int Missing, int Overtime, int NonCompliant);
public record ManagementDashboardResult(
    IReadOnlyCollection<ManagementEffortByDepartmentResult> EffortByDepartment,
    IReadOnlyCollection<ManagementEffortByProjectResult> EffortByProject,
    ManagementBillableResult Billable,
    ManagementConsultantVsInternalResult ConsultantVsInternal,
    IReadOnlyCollection<ManagementUnderOverResult> UnderOver,
    IReadOnlyCollection<ManagementComplianceResult> Compliance);

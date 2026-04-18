namespace TimeSheet.Domain.Interfaces;

public interface IDashboardRepository
{
    Task<EmployeeDashboardReadModel> GetEmployeeDashboardAsync(Guid userId, DateOnly today, DateOnly weekStart, CancellationToken ct = default);
    Task<ManagerDashboardReadModel> GetManagerDashboardAsync(Guid userId, DateOnly today, CancellationToken ct = default);
    Task<ManagementDashboardReadModel> GetManagementDashboardAsync(DateOnly today, DateOnly fromDate, CancellationToken ct = default);
}

public record EmployeeTodaySessionReadModel(DateOnly WorkDate, DateTime? CheckedIn, DateTime? CheckedOut, int BreakMinutes, int AttendanceMinutes);
public record EmployeeTodayTimesheetReadModel(string Status, string? MismatchReason, int EnteredMinutes, int PendingActions);
public record EmployeeWeeklyHoursReadModel(int Entered, int Breaks);
public record EmployeeProjectEffortReadModel(string Project, int Minutes);
public record EmployeeComplianceTrendReadModel(DateOnly WorkDate, bool IsCompliant);
public record EmployeeDashboardReadModel(
    EmployeeTodaySessionReadModel TodaySession,
    EmployeeTodayTimesheetReadModel TodayTimesheet,
    EmployeeWeeklyHoursReadModel WeeklyHours,
    IReadOnlyList<EmployeeProjectEffortReadModel> ProjectEffort,
    IReadOnlyList<EmployeeComplianceTrendReadModel> MonthlyComplianceTrend);

public record ManagerTeamAttendanceReadModel(int Present, int OnLeave, int NotCheckedIn);
public record ManagerTimesheetHealthReadModel(int Missing, int PendingApprovals);
public record ManagerMismatchReadModel(string Username, DateOnly WorkDate, string? MismatchReason);
public record ManagerUtilizationReadModel(double AvgMinutes);
public record ManagerContributionReadModel(string Project, int Minutes);
public record ManagerDashboardReadModel(
    ManagerTeamAttendanceReadModel TeamAttendance,
    ManagerTimesheetHealthReadModel TimesheetHealth,
    IReadOnlyList<ManagerMismatchReadModel> Mismatches,
    ManagerUtilizationReadModel Utilization,
    IReadOnlyList<ManagerContributionReadModel> Contributions);

public record ManagementEffortByDepartmentReadModel(string Department, int Minutes);
public record ManagementEffortByProjectReadModel(string Project, int Minutes);
public record ManagementBillableReadModel(int BillableMinutes, int NonBillableMinutes);
public record ManagementConsultantVsInternalReadModel(int Consultant, int Internal);
public record ManagementUnderOverReadModel(string Username, string Status, int Minutes);
public record ManagementComplianceReadModel(DateOnly WorkDate, int Missing, int Overtime, int NonCompliant);
public record ManagementDashboardReadModel(
    IReadOnlyList<ManagementEffortByDepartmentReadModel> EffortByDepartment,
    IReadOnlyList<ManagementEffortByProjectReadModel> EffortByProject,
    ManagementBillableReadModel Billable,
    ManagementConsultantVsInternalReadModel ConsultantVsInternal,
    IReadOnlyList<ManagementUnderOverReadModel> UnderOver,
    IReadOnlyList<ManagementComplianceReadModel> Compliance);

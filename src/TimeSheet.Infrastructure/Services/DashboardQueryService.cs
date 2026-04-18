using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Dashboard.Queries;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class DashboardQueryService(IDashboardRepository dashboardRepository) : IDashboardQueryService
{
    public async Task<EmployeeDashboardResult> GetEmployeeDashboardAsync(Guid userId, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var weekStart = StartOfWeek(today);
        var data = await dashboardRepository.GetEmployeeDashboardAsync(userId, today, weekStart, ct);
        return new EmployeeDashboardResult(
            new EmployeeTodaySessionResult(data.TodaySession.WorkDate, data.TodaySession.CheckedIn, data.TodaySession.CheckedOut, data.TodaySession.BreakMinutes, data.TodaySession.AttendanceMinutes),
            new EmployeeTodayTimesheetResult(data.TodayTimesheet.Status, data.TodayTimesheet.MismatchReason, data.TodayTimesheet.EnteredMinutes, data.TodayTimesheet.PendingActions),
            new EmployeeWeeklyHoursResult(data.WeeklyHours.Entered, data.WeeklyHours.Breaks),
            data.ProjectEffort.Select(x => new EmployeeProjectEffortResult(x.Project, x.Minutes)).ToList(),
            data.MonthlyComplianceTrend.Select(x => new EmployeeComplianceTrendResult(x.WorkDate, x.IsCompliant)).ToList());
    }

    public async Task<ManagerDashboardResult> GetManagerDashboardAsync(Guid userId, CancellationToken ct = default)
    {
        var data = await dashboardRepository.GetManagerDashboardAsync(userId, DateOnly.FromDateTime(DateTime.UtcNow), ct);
        return new ManagerDashboardResult(
            new ManagerTeamAttendanceResult(data.TeamAttendance.Present, data.TeamAttendance.OnLeave, data.TeamAttendance.NotCheckedIn),
            new ManagerTimesheetHealthResult(data.TimesheetHealth.Missing, data.TimesheetHealth.PendingApprovals),
            data.Mismatches.Select(x => new ManagerMismatchResult(x.Username, x.WorkDate, x.MismatchReason)).ToList(),
            new ManagerUtilizationResult(data.Utilization.AvgMinutes),
            data.Contributions.Select(x => new ManagerContributionResult(x.Project, x.Minutes)).ToList());
    }

    public async Task<ManagementDashboardResult> GetManagementDashboardAsync(CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var data = await dashboardRepository.GetManagementDashboardAsync(today, today.AddDays(-30), ct);
        return new ManagementDashboardResult(
            data.EffortByDepartment.Select(x => new ManagementEffortByDepartmentResult(x.Department, x.Minutes)).ToList(),
            data.EffortByProject.Select(x => new ManagementEffortByProjectResult(x.Project, x.Minutes)).ToList(),
            new ManagementBillableResult(data.Billable.BillableMinutes, data.Billable.NonBillableMinutes),
            new ManagementConsultantVsInternalResult(data.ConsultantVsInternal.Consultant, data.ConsultantVsInternal.Internal),
            data.UnderOver.Select(x => new ManagementUnderOverResult(x.Username, x.Status, x.Minutes)).ToList(),
            data.Compliance.Select(x => new ManagementComplianceResult(x.WorkDate, x.Missing, x.Overtime, x.NonCompliant)).ToList());
    }

    private static DateOnly StartOfWeek(DateOnly value)
    {
        var diff = ((int)value.DayOfWeek + 6) % 7;
        return value.AddDays(-diff);
    }
}

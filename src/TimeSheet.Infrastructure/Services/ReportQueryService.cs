using System.Globalization;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Reports.Queries;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class ReportQueryService(
    IReportRepository reportRepository,
    ICurrentUserService currentUserService) : IReportQueryService
{
    public async Task<PagedResult<AttendanceSummaryReportResult>> GetAttendanceSummaryAsync(ReportFilterModel filter, CancellationToken ct = default)
    {
        var scope = await BuildScopeAsync(filter, ct);
        var (items, totalCount, page) = await reportRepository.GetAttendanceSummaryPageAsync(scope.UserIds, scope.Filter.FromDate, scope.Filter.ToDate, scope.Filter.Page, scope.Filter.PageSize, ct);
        return new PagedResult<AttendanceSummaryReportResult>(items.Select(x => new AttendanceSummaryReportResult(x.UserId, x.Username, x.WorkDate, x.AttendanceMinutes, x.BreakMinutes, x.HasException)).ToList(), page, scope.Filter.PageSize, totalCount, GetTotalPages(totalCount, scope.Filter.PageSize));
    }

    public async Task<PagedResult<TimesheetSummaryReportResult>> GetTimesheetSummaryAsync(ReportFilterModel filter, CancellationToken ct = default)
    {
        var scope = await BuildScopeAsync(filter, ct);
        var (items, totalCount, page) = await reportRepository.GetTimesheetSummaryPageAsync(scope.UserIds, scope.Filter.FromDate, scope.Filter.ToDate, scope.Filter.Page, scope.Filter.PageSize, ct);
        return new PagedResult<TimesheetSummaryReportResult>(items.Select(x => new TimesheetSummaryReportResult(x.UserId, x.Username, x.WorkDate, x.Status, x.EnteredMinutes, x.AttendanceMinutes, x.HasMismatch)).ToList(), page, scope.Filter.PageSize, totalCount, GetTotalPages(totalCount, scope.Filter.PageSize));
    }

    public async Task<PagedResult<ProjectEffortReportResult>> GetProjectEffortAsync(ReportFilterModel filter, CancellationToken ct = default)
    {
        var scope = await BuildScopeAsync(filter, ct);
        var (items, totalCount, page) = await reportRepository.GetProjectEffortPageAsync(scope.UserIds, scope.Filter.FromDate, scope.Filter.ToDate, scope.Filter.ProjectId, scope.Filter.Page, scope.Filter.PageSize, ct);
        return new PagedResult<ProjectEffortReportResult>(items.Select(x => new ProjectEffortReportResult(x.ProjectId, x.ProjectName, x.ProjectCode, x.TotalMinutes, x.DistinctContributors)).ToList(), page, scope.Filter.PageSize, totalCount, GetTotalPages(totalCount, scope.Filter.PageSize));
    }

    public async Task<PagedResult<LeaveUtilizationReportResult>> GetLeaveUtilizationAsync(ReportFilterModel filter, CancellationToken ct = default)
    {
        var scope = await BuildScopeAsync(filter, ct);
        var (items, totalCount, page) = await reportRepository.GetLeaveUtilizationPageAsync(scope.UserIds, scope.Filter.FromDate, scope.Filter.ToDate, scope.Filter.Page, scope.Filter.PageSize, ct);
        return new PagedResult<LeaveUtilizationReportResult>(items.Select(x => new LeaveUtilizationReportResult(x.UserId, x.Username, x.LeaveDays, x.HalfDays, x.TimesheetMinutes, x.UtilizationPercent)).ToList(), page, scope.Filter.PageSize, totalCount, GetTotalPages(totalCount, scope.Filter.PageSize));
    }

    public async Task<PagedResult<LeaveBalanceReportResult>> GetLeaveBalanceAsync(ReportFilterModel filter, CancellationToken ct = default)
    {
        var scope = await BuildScopeAsync(filter, ct);
        var year = scope.Filter.FromDate?.Year ?? DateTime.UtcNow.Year;
        var (items, totalCount, page) = await reportRepository.GetLeaveBalancePageAsync(scope.UserIds, year, scope.Filter.Page, scope.Filter.PageSize, ct);
        return new PagedResult<LeaveBalanceReportResult>(items.Select(x => new LeaveBalanceReportResult(x.UserId, x.Username, x.LeaveTypeName, x.AllocatedDays, x.UsedDays, x.RemainingDays)).ToList(), page, scope.Filter.PageSize, totalCount, GetTotalPages(totalCount, scope.Filter.PageSize));
    }

    public async Task<PagedResult<TimesheetApprovalStatusReportResult>> GetTimesheetApprovalStatusAsync(ReportFilterModel filter, CancellationToken ct = default)
    {
        var scope = await BuildScopeAsync(filter, ct);
        var (items, totalCount, page) = await reportRepository.GetTimesheetApprovalStatusPageAsync(scope.UserIds, scope.Filter.FromDate, scope.Filter.ToDate, scope.Filter.Page, scope.Filter.PageSize, ct);
        return new PagedResult<TimesheetApprovalStatusReportResult>(items.Select(x => new TimesheetApprovalStatusReportResult(x.UserId, x.Username, x.WorkDate, x.EnteredMinutes, x.Status, x.ApprovedByUsername, x.ApprovedAtUtc)).ToList(), page, scope.Filter.PageSize, totalCount, GetTotalPages(totalCount, scope.Filter.PageSize));
    }

    public async Task<PagedResult<OvertimeDeficitReportResult>> GetOvertimeDeficitAsync(ReportFilterModel filter, CancellationToken ct = default)
    {
        var scope = await BuildScopeAsync(filter, ct);
        var (items, totalCount, page) = await reportRepository.GetOvertimeDeficitPageAsync(scope.UserIds, scope.Filter.FromDate, scope.Filter.ToDate, scope.Filter.Page, scope.Filter.PageSize, ct);
        return new PagedResult<OvertimeDeficitReportResult>(items.Select(x => new OvertimeDeficitReportResult(x.UserId, x.Username, x.WeekStart, x.TargetMinutes, x.LoggedMinutes, x.DeltaMinutes)).ToList(), page, scope.Filter.PageSize, totalCount, GetTotalPages(totalCount, scope.Filter.PageSize));
    }

    public async Task<ReportExportResult?> BuildExportAsync(string reportKey, ReportFilterModel filter, CancellationToken ct = default)
    {
        var exportFilter = new ReportFilterModel(
            filter.FromDate,
            filter.ToDate,
            filter.UserId,
            filter.DepartmentId,
            filter.ProjectId,
            1,
            200);

        return reportKey.ToLowerInvariant() switch
        {
            "attendance-summary" => await BuildAllPagesAsync(GetAttendanceSummaryAsync, exportFilter, reportKey, new[] { "userId", "username", "workDate", "attendanceMinutes", "breakMinutes", "hasException" }, x => new[] { x.UserId.ToString(), x.Username, x.WorkDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), x.AttendanceMinutes.ToString(), x.BreakMinutes.ToString(), x.HasException.ToString() }, ct),
            "timesheet-summary" => await BuildAllPagesAsync(GetTimesheetSummaryAsync, exportFilter, reportKey, new[] { "userId", "username", "workDate", "status", "enteredMinutes", "attendanceMinutes", "hasMismatch" }, x => new[] { x.UserId.ToString(), x.Username, x.WorkDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), x.Status, x.EnteredMinutes.ToString(), x.AttendanceMinutes.ToString(), x.HasMismatch.ToString() }, ct),
            "project-effort" => await BuildAllPagesAsync(GetProjectEffortAsync, exportFilter, reportKey, new[] { "projectId", "projectName", "projectCode", "totalMinutes", "distinctContributors" }, x => new[] { x.ProjectId.ToString(), x.ProjectName, x.ProjectCode, x.TotalMinutes.ToString(), x.DistinctContributors.ToString() }, ct),
            "leave-utilization" => await BuildAllPagesAsync(GetLeaveUtilizationAsync, exportFilter, reportKey, new[] { "userId", "username", "leaveDays", "halfDays", "timesheetMinutes", "utilizationPercent" }, x => new[] { x.UserId.ToString(), x.Username, x.LeaveDays.ToString(), x.HalfDays.ToString(), x.TimesheetMinutes.ToString(), x.UtilizationPercent.ToString(CultureInfo.InvariantCulture) }, ct),
            "leave-balance" => await BuildAllPagesAsync(GetLeaveBalanceAsync, exportFilter, reportKey, new[] { "userId", "username", "leaveTypeName", "allocatedDays", "usedDays", "remainingDays" }, x => new[] { x.UserId.ToString(), x.Username, x.LeaveTypeName, x.AllocatedDays.ToString(), x.UsedDays.ToString(), x.RemainingDays.ToString() }, ct),
            "timesheet-approval-status" => await BuildAllPagesAsync(GetTimesheetApprovalStatusAsync, exportFilter, reportKey, new[] { "userId", "username", "workDate", "enteredMinutes", "status", "approvedByUsername", "approvedAtUtc" }, x => new[] { x.UserId.ToString(), x.Username, x.WorkDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), x.EnteredMinutes.ToString(), x.Status, x.ApprovedByUsername ?? string.Empty, x.ApprovedAtUtc?.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) ?? string.Empty }, ct),
            "overtime-deficit" => await BuildAllPagesAsync(GetOvertimeDeficitAsync, exportFilter, reportKey, new[] { "userId", "username", "weekStart", "targetMinutes", "loggedMinutes", "deltaMinutes" }, x => new[] { x.UserId.ToString(), x.Username, x.WeekStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), x.TargetMinutes.ToString(), x.LoggedMinutes.ToString(), x.DeltaMinutes.ToString() }, ct),
            _ => null
        };
    }

    private async Task<(List<Guid> UserIds, ReportFilterModel Filter)> BuildScopeAsync(ReportFilterModel filter, CancellationToken ct)
    {
        var userIds = await reportRepository.GetScopedUserIdsAsync(
            currentUserService.UserId,
            currentUserService.Role,
            filter.UserId,
            filter.DepartmentId,
            ct);

        return (userIds, new ReportFilterModel(filter.FromDate, filter.ToDate, filter.UserId, filter.DepartmentId, filter.ProjectId, Math.Max(1, filter.Page), Math.Clamp(filter.PageSize, 1, 200)));
    }

    private static int GetTotalPages(int totalCount, int pageSize)
        => Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));

    private static async Task<ReportExportResult> BuildAllPagesAsync<T>(
        Func<ReportFilterModel, CancellationToken, Task<PagedResult<T>>> fetch,
        ReportFilterModel seedFilter,
        string reportKey,
        string[] headers,
        Func<T, string[]> map,
        CancellationToken ct)
    {
        var rows = new List<string[]>();
        var page = 1;
        while (true)
        {
            var current = await fetch(seedFilter with { Page = page }, ct);
            rows.AddRange(current.Items.Select(map));
            if (page >= current.TotalPages) break;
            page++;
        }

        return new ReportExportResult(headers, rows, $"{reportKey}-{DateTime.UtcNow:yyyyMMdd}");
    }
}

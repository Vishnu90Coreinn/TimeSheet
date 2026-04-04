using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Reports.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface IReportQueryService
{
    Task<PagedResult<AttendanceSummaryReportResult>> GetAttendanceSummaryAsync(ReportFilterModel filter, CancellationToken ct = default);
    Task<PagedResult<TimesheetSummaryReportResult>> GetTimesheetSummaryAsync(ReportFilterModel filter, CancellationToken ct = default);
    Task<PagedResult<ProjectEffortReportResult>> GetProjectEffortAsync(ReportFilterModel filter, CancellationToken ct = default);
    Task<PagedResult<LeaveUtilizationReportResult>> GetLeaveUtilizationAsync(ReportFilterModel filter, CancellationToken ct = default);
    Task<PagedResult<LeaveBalanceReportResult>> GetLeaveBalanceAsync(ReportFilterModel filter, CancellationToken ct = default);
    Task<PagedResult<TimesheetApprovalStatusReportResult>> GetTimesheetApprovalStatusAsync(ReportFilterModel filter, CancellationToken ct = default);
    Task<PagedResult<OvertimeDeficitReportResult>> GetOvertimeDeficitAsync(ReportFilterModel filter, CancellationToken ct = default);
    Task<ReportExportResult?> BuildExportAsync(string reportKey, ReportFilterModel filter, CancellationToken ct = default);
}

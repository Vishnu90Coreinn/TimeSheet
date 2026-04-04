using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Reports.Queries;

public record GetAttendanceSummaryReportQuery(ReportFilterModel Filter) : IRequest<Result<PagedResult<AttendanceSummaryReportResult>>>;
public record GetTimesheetSummaryReportQuery(ReportFilterModel Filter) : IRequest<Result<PagedResult<TimesheetSummaryReportResult>>>;
public record GetProjectEffortReportQuery(ReportFilterModel Filter) : IRequest<Result<PagedResult<ProjectEffortReportResult>>>;
public record GetLeaveUtilizationReportQuery(ReportFilterModel Filter) : IRequest<Result<PagedResult<LeaveUtilizationReportResult>>>;
public record GetLeaveBalanceReportQuery(ReportFilterModel Filter) : IRequest<Result<PagedResult<LeaveBalanceReportResult>>>;
public record GetTimesheetApprovalStatusReportQuery(ReportFilterModel Filter) : IRequest<Result<PagedResult<TimesheetApprovalStatusReportResult>>>;
public record GetOvertimeDeficitReportQuery(ReportFilterModel Filter) : IRequest<Result<PagedResult<OvertimeDeficitReportResult>>>;
public record ExportReportQuery(string ReportKey, ReportFilterModel Filter) : IRequest<Result<ReportExportResult>>;

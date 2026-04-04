using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Reports.Queries;

public class GetAttendanceSummaryReportQueryHandler(IReportQueryService service)
    : IRequestHandler<GetAttendanceSummaryReportQuery, Result<PagedResult<AttendanceSummaryReportResult>>>
{
    public async Task<Result<PagedResult<AttendanceSummaryReportResult>>> Handle(GetAttendanceSummaryReportQuery request, CancellationToken cancellationToken)
        => Result<PagedResult<AttendanceSummaryReportResult>>.Success(await service.GetAttendanceSummaryAsync(request.Filter, cancellationToken));
}

public class GetTimesheetSummaryReportQueryHandler(IReportQueryService service)
    : IRequestHandler<GetTimesheetSummaryReportQuery, Result<PagedResult<TimesheetSummaryReportResult>>>
{
    public async Task<Result<PagedResult<TimesheetSummaryReportResult>>> Handle(GetTimesheetSummaryReportQuery request, CancellationToken cancellationToken)
        => Result<PagedResult<TimesheetSummaryReportResult>>.Success(await service.GetTimesheetSummaryAsync(request.Filter, cancellationToken));
}

public class GetProjectEffortReportQueryHandler(IReportQueryService service)
    : IRequestHandler<GetProjectEffortReportQuery, Result<PagedResult<ProjectEffortReportResult>>>
{
    public async Task<Result<PagedResult<ProjectEffortReportResult>>> Handle(GetProjectEffortReportQuery request, CancellationToken cancellationToken)
        => Result<PagedResult<ProjectEffortReportResult>>.Success(await service.GetProjectEffortAsync(request.Filter, cancellationToken));
}

public class GetLeaveUtilizationReportQueryHandler(IReportQueryService service)
    : IRequestHandler<GetLeaveUtilizationReportQuery, Result<PagedResult<LeaveUtilizationReportResult>>>
{
    public async Task<Result<PagedResult<LeaveUtilizationReportResult>>> Handle(GetLeaveUtilizationReportQuery request, CancellationToken cancellationToken)
        => Result<PagedResult<LeaveUtilizationReportResult>>.Success(await service.GetLeaveUtilizationAsync(request.Filter, cancellationToken));
}

public class GetLeaveBalanceReportQueryHandler(IReportQueryService service)
    : IRequestHandler<GetLeaveBalanceReportQuery, Result<PagedResult<LeaveBalanceReportResult>>>
{
    public async Task<Result<PagedResult<LeaveBalanceReportResult>>> Handle(GetLeaveBalanceReportQuery request, CancellationToken cancellationToken)
        => Result<PagedResult<LeaveBalanceReportResult>>.Success(await service.GetLeaveBalanceAsync(request.Filter, cancellationToken));
}

public class GetTimesheetApprovalStatusReportQueryHandler(IReportQueryService service)
    : IRequestHandler<GetTimesheetApprovalStatusReportQuery, Result<PagedResult<TimesheetApprovalStatusReportResult>>>
{
    public async Task<Result<PagedResult<TimesheetApprovalStatusReportResult>>> Handle(GetTimesheetApprovalStatusReportQuery request, CancellationToken cancellationToken)
        => Result<PagedResult<TimesheetApprovalStatusReportResult>>.Success(await service.GetTimesheetApprovalStatusAsync(request.Filter, cancellationToken));
}

public class GetOvertimeDeficitReportQueryHandler(IReportQueryService service)
    : IRequestHandler<GetOvertimeDeficitReportQuery, Result<PagedResult<OvertimeDeficitReportResult>>>
{
    public async Task<Result<PagedResult<OvertimeDeficitReportResult>>> Handle(GetOvertimeDeficitReportQuery request, CancellationToken cancellationToken)
        => Result<PagedResult<OvertimeDeficitReportResult>>.Success(await service.GetOvertimeDeficitAsync(request.Filter, cancellationToken));
}

public class ExportReportQueryHandler(IReportQueryService service)
    : IRequestHandler<ExportReportQuery, Result<ReportExportResult>>
{
    public async Task<Result<ReportExportResult>> Handle(ExportReportQuery request, CancellationToken cancellationToken)
    {
        var result = await service.BuildExportAsync(request.ReportKey, request.Filter, cancellationToken);
        return result is null
            ? Result<ReportExportResult>.NotFound("Unknown report key.")
            : Result<ReportExportResult>.Success(result);
    }
}

using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Queries;

public class GetPendingTimesheetsQueryHandler(
    IApprovalQueryService approvalQueryService,
    ICurrentUserService currentUser)
    : IRequestHandler<GetPendingTimesheetsQuery, Result<PagedResult<PendingTimesheetItem>>>
{
    public async Task<Result<PagedResult<PendingTimesheetItem>>> Handle(
        GetPendingTimesheetsQuery request,
        CancellationToken cancellationToken)
    {
        var page = await approvalQueryService.GetPendingTimesheetsPageAsync(
            currentUser.UserId,
            request.Search,
            request.HasMismatch,
            request.SortBy,
            request.Descending,
            request.Page,
            request.PageSize,
            cancellationToken);

        var items = page.Items.Select(i => new PendingTimesheetItem(
            i.TimesheetId,
            i.UserId,
            i.Username,
            i.DisplayName,
            i.WorkDate,
            i.EnteredMinutes,
            i.Status,
            i.SubmittedAtUtc,
            i.HasMismatch,
            i.MismatchReason,
            i.DelegatedFromUsername)).ToList();

        return Result<PagedResult<PendingTimesheetItem>>.Success(
            new PagedResult<PendingTimesheetItem>(
                items,
                page.Page,
                page.PageSize,
                page.TotalCount,
                page.TotalPages,
                page.SortBy,
                page.SortDir));
    }
}

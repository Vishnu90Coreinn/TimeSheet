using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Queries;

public class GetApprovalHistoryQueryHandler(
    IApprovalQueryService approvalQuery,
    ICurrentUserService currentUser)
    : IRequestHandler<GetApprovalHistoryQuery, Result<List<ApprovalActionResult>>>
{
    public async Task<Result<List<ApprovalActionResult>>> Handle(
        GetApprovalHistoryQuery request, CancellationToken ct)
    {
        var ownerId = await approvalQuery.GetTimesheetOwnerAsync(request.TimesheetId, ct);
        if (ownerId is null)
            return Result<List<ApprovalActionResult>>.NotFound("Timesheet not found.");

        var canView = ownerId.Value == currentUser.UserId || currentUser.IsAdmin || currentUser.IsManager;
        if (!canView)
            return Result<List<ApprovalActionResult>>.Forbidden("You do not have access to this timesheet's history.");

        var history = await approvalQuery.GetHistoryAsync(request.TimesheetId, ct);
        return Result<List<ApprovalActionResult>>.Success(history);
    }
}

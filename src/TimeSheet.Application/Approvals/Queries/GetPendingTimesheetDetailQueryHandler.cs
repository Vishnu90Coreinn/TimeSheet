using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Approvals.Queries;

public class GetPendingTimesheetDetailQueryHandler(
    ITimesheetRepository timesheetRepository,
    IApprovalDelegationRepository delegationRepository,
    ICurrentUserService currentUser)
    : IRequestHandler<GetPendingTimesheetDetailQuery, Result<PendingTimesheetDetailResult>>
{
    public async Task<Result<PendingTimesheetDetailResult>> Handle(GetPendingTimesheetDetailQuery request, CancellationToken cancellationToken)
    {
        var timesheet = await timesheetRepository.GetByIdAsync(request.TimesheetId, cancellationToken);
        if (timesheet is null)
            return Result<PendingTimesheetDetailResult>.NotFound("Timesheet not found.");

        var isDirectManager = timesheet.User?.ManagerId == currentUser.UserId;
        var isAdmin = currentUser.IsAdmin;
        if (!isDirectManager && !isAdmin)
        {
            if (timesheet.User?.ManagerId is not { } managerId)
                return Result<PendingTimesheetDetailResult>.Forbidden("You do not have access to this timesheet.");

            var delegations = await delegationRepository.GetActiveDelegationsForDelegateAsync(currentUser.UserId, cancellationToken);
            if (!delegations.Any(d => d.FromUserId == managerId))
                return Result<PendingTimesheetDetailResult>.Forbidden("You do not have access to this timesheet.");
        }

        var entries = timesheet.Entries
            .OrderByDescending(e => e.Minutes)
            .Select(e => new PendingTimesheetDetailEntryResult(
                e.Id,
                e.ProjectId,
                e.Project?.Name ?? "Unknown project",
                e.TaskCategoryId,
                e.TaskCategory?.Name ?? "Unknown category",
                e.Minutes,
                e.Notes))
            .ToList();

        var displayName = string.IsNullOrWhiteSpace(timesheet.User?.DisplayName)
            ? (timesheet.User?.Username ?? "unknown")
            : timesheet.User!.DisplayName;

        return Result<PendingTimesheetDetailResult>.Success(new PendingTimesheetDetailResult(
            timesheet.Id,
            timesheet.UserId,
            timesheet.User?.Username ?? "unknown",
            displayName,
            timesheet.WorkDate,
            timesheet.Status.ToString().ToLowerInvariant(),
            entries.Sum(e => e.Minutes),
            timesheet.MismatchReason,
            timesheet.SubmittedAtUtc,
            entries));
    }
}

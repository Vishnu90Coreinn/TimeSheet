using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Approvals.Queries;

public class GetPendingTimesheetsQueryHandler(
    ITimesheetRepository timesheetRepository,
    IApprovalDelegationRepository delegationRepository,
    ICurrentUserService currentUser)
    : IRequestHandler<GetPendingTimesheetsQuery, Result<List<PendingTimesheetItem>>>
{
    public async Task<Result<List<PendingTimesheetItem>>> Handle(
        GetPendingTimesheetsQuery request,
        CancellationToken cancellationToken)
    {
        // Own direct reports
        var timesheets = await timesheetRepository.GetPendingForManagerAsync(currentUser.UserId, cancellationToken);

        var items = timesheets.Select(t => new PendingTimesheetItem(
            TimesheetId: t.Id,
            UserId: t.UserId,
            Username: t.User?.Username ?? "unknown",
            DisplayName: string.IsNullOrWhiteSpace(t.User?.DisplayName) ? (t.User?.Username ?? "unknown") : t.User.DisplayName,
            WorkDate: t.WorkDate,
            EnteredMinutes: t.Entries?.Sum(e => e.Minutes) ?? 0,
            Status: t.Status.ToString().ToLowerInvariant(),
            SubmittedAtUtc: t.SubmittedAtUtc,
            HasMismatch: t.MismatchReason is not null,
            MismatchReason: t.MismatchReason
        )).ToList();

        // Delegated: if current user is a delegate for another manager, include that manager's pending items
        var activeDelegations = await delegationRepository.GetActiveDelegationsForDelegateAsync(currentUser.UserId, cancellationToken);
        foreach (var delegation in activeDelegations)
        {
            var delegatedTimesheets = await timesheetRepository.GetPendingForManagerAsync(delegation.FromUserId, cancellationToken);
            var delegatedItems = delegatedTimesheets.Select(t => new PendingTimesheetItem(
                TimesheetId: t.Id,
                UserId: t.UserId,
                Username: t.User?.Username ?? "unknown",
                DisplayName: string.IsNullOrWhiteSpace(t.User?.DisplayName) ? (t.User?.Username ?? "unknown") : t.User.DisplayName,
                WorkDate: t.WorkDate,
                EnteredMinutes: t.Entries?.Sum(e => e.Minutes) ?? 0,
                Status: t.Status.ToString().ToLowerInvariant(),
                SubmittedAtUtc: t.SubmittedAtUtc,
                HasMismatch: t.MismatchReason is not null,
                MismatchReason: t.MismatchReason,
                DelegatedFromUsername: delegation.FromUser.Username
            ));
            items.AddRange(delegatedItems);
        }

        return Result<List<PendingTimesheetItem>>.Success(items);
    }
}

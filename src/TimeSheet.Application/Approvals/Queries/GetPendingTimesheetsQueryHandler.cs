using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Approvals.Queries;

public class GetPendingTimesheetsQueryHandler(
    ITimesheetRepository timesheetRepository,
    ICurrentUserService currentUser)
    : IRequestHandler<GetPendingTimesheetsQuery, Result<List<PendingTimesheetItem>>>
{
    public async Task<Result<List<PendingTimesheetItem>>> Handle(
        GetPendingTimesheetsQuery request,
        CancellationToken cancellationToken)
    {
        var timesheets = await timesheetRepository.GetPendingForManagerAsync(currentUser.UserId, cancellationToken);

        var items = timesheets.Select(t => new PendingTimesheetItem(
            TimesheetId: t.Id,
            UserId: t.UserId,
            Username: t.User?.Username ?? "unknown",
            WorkDate: t.WorkDate,
            EnteredMinutes: t.Entries?.Sum(e => e.Minutes) ?? 0,
            Status: t.Status.ToString().ToLowerInvariant(),
            SubmittedAtUtc: t.SubmittedAtUtc,
            HasMismatch: t.MismatchReason is not null,
            MismatchReason: t.MismatchReason
        )).ToList();

        return Result<List<PendingTimesheetItem>>.Success(items);
    }
}

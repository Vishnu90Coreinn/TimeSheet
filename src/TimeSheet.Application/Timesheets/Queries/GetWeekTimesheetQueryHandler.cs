using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Timesheets.Queries;

public class GetWeekTimesheetQueryHandler(
    ITimesheetQueryService timesheetQueryService,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider)
    : IRequestHandler<GetWeekTimesheetQuery, Result<TimesheetWeekResult>>
{
    public async Task<Result<TimesheetWeekResult>> Handle(
        GetWeekTimesheetQuery request,
        CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId;
        var anchor = request.AnyDateInWeek ?? dateTimeProvider.TodayUtc;

        var result = await timesheetQueryService.GetWeekAsync(userId, anchor, cancellationToken);

        return Result<TimesheetWeekResult>.Success(result);
    }
}

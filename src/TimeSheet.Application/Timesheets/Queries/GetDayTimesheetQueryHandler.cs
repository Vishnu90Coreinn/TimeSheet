using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Timesheets.Queries;

public class GetDayTimesheetQueryHandler(
    ITimesheetQueryService timesheetQueryService,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider)
    : IRequestHandler<GetDayTimesheetQuery, Result<TimesheetDayResult>>
{
    public async Task<Result<TimesheetDayResult>> Handle(
        GetDayTimesheetQuery request,
        CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId;
        var date = request.WorkDate ?? dateTimeProvider.TodayUtc;

        var result = await timesheetQueryService.GetDayAsync(userId, date, cancellationToken)
            ?? new TimesheetDayResult(Guid.Empty, date, "draft", 0, 0, 0, 0, false, null, null, []);

        return Result<TimesheetDayResult>.Success(result);
    }
}

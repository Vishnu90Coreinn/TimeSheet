using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Overtime.Queries;

public class GetOvertimeSummaryQueryHandler(
    IOvertimeCalculationService overtimeCalculationService,
    ICurrentUserService currentUserService)
    : IRequestHandler<GetOvertimeSummaryQuery, Result<OvertimeSummaryResult>>
{
    public async Task<Result<OvertimeSummaryResult>> Handle(GetOvertimeSummaryQuery request, CancellationToken cancellationToken)
    {
        var userId = request.UserId ?? currentUserService.UserId;
        var weekStart = StartOfWeek(request.WeekStart);
        var weekEnd = weekStart.AddDays(6);

        var summary = await overtimeCalculationService.CalculateUserWeekAsync(userId, weekStart, approvedOnly: false, cancellationToken);

        return Result<OvertimeSummaryResult>.Success(new OvertimeSummaryResult(
            UserId: userId,
            WeekStart: weekStart,
            WeekEnd: weekEnd,
            RegularHours: summary.RegularHours,
            OvertimeHours: summary.OvertimeHours,
            CompOffCredits: summary.CompOffCredits));
    }

    private static DateOnly StartOfWeek(DateOnly value)
    {
        var diff = ((int)value.DayOfWeek + 6) % 7;
        return value.AddDays(-diff);
    }
}


using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Overtime.Queries;

public class GetTeamOvertimeSummaryQueryHandler(
    IOvertimeCalculationService overtimeCalculationService,
    ICurrentUserService currentUserService)
    : IRequestHandler<GetTeamOvertimeSummaryQuery, Result<TeamOvertimeSummaryResult>>
{
    public async Task<Result<TeamOvertimeSummaryResult>> Handle(GetTeamOvertimeSummaryQuery request, CancellationToken cancellationToken)
    {
        var weekStart = StartOfWeek(request.WeekStart);
        var weekEnd = weekStart.AddDays(6);

        var totalHours = await overtimeCalculationService.CalculateTeamOvertimeHoursAsync(currentUserService.UserId, weekStart, cancellationToken);

        return Result<TeamOvertimeSummaryResult>.Success(new TeamOvertimeSummaryResult(
            WeekStart: weekStart,
            WeekEnd: weekEnd,
            TotalOvertimeHours: totalHours));
    }

    private static DateOnly StartOfWeek(DateOnly value)
    {
        var diff = ((int)value.DayOfWeek + 6) % 7;
        return value.AddDays(-diff);
    }
}


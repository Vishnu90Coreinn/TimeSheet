using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class OvertimeCalculationService(IOvertimeRepository overtimeRepository) : IOvertimeCalculationService
{
    public async Task<OvertimeCalculationResult> CalculateUserWeekAsync(Guid userId, DateOnly weekStart, bool approvedOnly, CancellationToken ct = default)
    {
        var weekEnd = weekStart.AddDays(6);
        var policy = await overtimeRepository.GetUserPolicyAsync(userId, ct);
        if (policy is null)
            return new OvertimeCalculationResult(0m, 0m, 0m);

        var dayHours = await overtimeRepository.GetDayHoursAsync(userId, weekStart, weekEnd, approvedOnly, ct);
        if (dayHours.Count == 0)
            return new OvertimeCalculationResult(0m, 0m, 0m);

        var totalHours = dayHours.Sum(x => x.Hours);
        var dailyOvertime = dayHours.Sum(x => Math.Max(0m, x.Hours - policy.DailyThreshold));
        var weeklyOvertime = Math.Max(0m, totalHours - policy.WeeklyThreshold);
        var overtimeHours = Math.Max(dailyOvertime, weeklyOvertime);
        var regularHours = Math.Max(0m, totalHours - overtimeHours);
        var compOffCredits = policy.CompOffEnabled
            ? Math.Round(overtimeHours * policy.Multiplier, 2, MidpointRounding.AwayFromZero)
            : 0m;

        return new OvertimeCalculationResult(
            Math.Round(regularHours, 2, MidpointRounding.AwayFromZero),
            Math.Round(overtimeHours, 2, MidpointRounding.AwayFromZero),
            compOffCredits);
    }

    public async Task<decimal> CalculateTeamOvertimeHoursAsync(Guid managerUserId, DateOnly weekStart, CancellationToken ct = default)
    {
        var teamUserIds = await overtimeRepository.GetActiveTeamUserIdsAsync(managerUserId, ct);
        decimal total = 0m;

        foreach (var userId in teamUserIds)
        {
            total += (await CalculateUserWeekAsync(userId, weekStart, approvedOnly: false, ct)).OvertimeHours;
        }

        return Math.Round(total, 2, MidpointRounding.AwayFromZero);
    }
}

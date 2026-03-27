using Microsoft.EntityFrameworkCore;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Enums;
using TimeSheet.Infrastructure.Persistence;

namespace TimeSheet.Infrastructure.Services;

public class OvertimeCalculationService(TimeSheetDbContext dbContext) : IOvertimeCalculationService
{
    public async Task<OvertimeCalculationResult> CalculateUserWeekAsync(Guid userId, DateOnly weekStart, bool approvedOnly, CancellationToken ct = default)
    {
        var weekEnd = weekStart.AddDays(6);

        var user = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.Id, u.WorkPolicyId })
            .SingleOrDefaultAsync(ct);

        if (user is null)
            return new OvertimeCalculationResult(0m, 0m, 0m);

        var policy = user.WorkPolicyId is Guid workPolicyId
            ? await dbContext.OvertimePolicies.AsNoTracking().SingleOrDefaultAsync(x => x.WorkPolicyId == workPolicyId, ct)
            : null;

        var dailyThreshold = policy?.DailyOvertimeAfterHours ?? 8m;
        var weeklyThreshold = policy?.WeeklyOvertimeAfterHours ?? 40m;
        var multiplier = policy?.OvertimeMultiplier ?? 1.5m;
        var compOffEnabled = policy?.CompOffEnabled ?? false;

        var query = dbContext.Timesheets
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.WorkDate >= weekStart && t.WorkDate <= weekEnd);

        if (approvedOnly)
            query = query.Where(t => t.Status == TimesheetStatus.Approved);

        var dayHours = await query
            .Select(t => new
            {
                t.WorkDate,
                Hours = t.Entries.Sum(e => e.Minutes) / 60m
            })
            .ToListAsync(ct);

        if (dayHours.Count == 0)
            return new OvertimeCalculationResult(0m, 0m, 0m);

        var totalHours = dayHours.Sum(x => x.Hours);
        var dailyOvertime = dayHours.Sum(x => Math.Max(0m, x.Hours - dailyThreshold));
        var weeklyOvertime = Math.Max(0m, totalHours - weeklyThreshold);
        var overtimeHours = Math.Max(dailyOvertime, weeklyOvertime);
        var regularHours = Math.Max(0m, totalHours - overtimeHours);
        var compOffCredits = compOffEnabled ? Math.Round(overtimeHours * multiplier, 2, MidpointRounding.AwayFromZero) : 0m;

        return new OvertimeCalculationResult(
            RegularHours: Math.Round(regularHours, 2, MidpointRounding.AwayFromZero),
            OvertimeHours: Math.Round(overtimeHours, 2, MidpointRounding.AwayFromZero),
            CompOffCredits: compOffCredits);
    }

    public async Task<decimal> CalculateTeamOvertimeHoursAsync(Guid managerUserId, DateOnly weekStart, CancellationToken ct = default)
    {
        var teamUserIds = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.ManagerId == managerUserId && u.IsActive)
            .Select(u => u.Id)
            .ToListAsync(ct);

        if (teamUserIds.Count == 0)
            return 0m;

        decimal total = 0m;
        foreach (var userId in teamUserIds)
        {
            var userResult = await CalculateUserWeekAsync(userId, weekStart, approvedOnly: false, ct);
            total += userResult.OvertimeHours;
        }

        return Math.Round(total, 2, MidpointRounding.AwayFromZero);
    }
}


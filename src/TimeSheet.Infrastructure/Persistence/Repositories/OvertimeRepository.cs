using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class OvertimeRepository(TimeSheetDbContext dbContext) : IOvertimeRepository
{
    public async Task<OvertimeUserPolicyRow?> GetUserPolicyAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.WorkPolicyId })
            .SingleOrDefaultAsync(ct);

        if (user is null)
            return null;

        if (user.WorkPolicyId is not Guid workPolicyId)
            return new OvertimeUserPolicyRow(8m, 40m, 1.5m, false);

        var policy = await dbContext.OvertimePolicies
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.WorkPolicyId == workPolicyId, ct);

        return new OvertimeUserPolicyRow(
            policy?.DailyOvertimeAfterHours ?? 8m,
            policy?.WeeklyOvertimeAfterHours ?? 40m,
            policy?.OvertimeMultiplier ?? 1.5m,
            policy?.CompOffEnabled ?? false);
    }

    public async Task<IReadOnlyList<OvertimeDayHoursRow>> GetDayHoursAsync(Guid userId, DateOnly weekStart, DateOnly weekEnd, bool approvedOnly, CancellationToken ct = default)
    {
        var query = dbContext.Timesheets
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.WorkDate >= weekStart && t.WorkDate <= weekEnd);

        if (approvedOnly)
            query = query.Where(t => t.Status == TimesheetStatus.Approved);

        return await query
            .Select(t => new OvertimeDayHoursRow(t.WorkDate, t.Entries.Sum(e => e.Minutes) / 60m))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Guid>> GetActiveTeamUserIdsAsync(Guid managerUserId, CancellationToken ct = default)
        => await dbContext.Users
            .AsNoTracking()
            .Where(u => u.ManagerId == managerUserId && u.IsActive)
            .Select(u => u.Id)
            .ToListAsync(ct);
}

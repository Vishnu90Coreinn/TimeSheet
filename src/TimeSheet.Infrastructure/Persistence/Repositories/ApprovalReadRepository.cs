using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class ApprovalReadRepository(TimeSheetDbContext context) : IApprovalReadRepository
{
    public async Task<Guid?> GetTimesheetOwnerAsync(Guid timesheetId, CancellationToken ct = default)
        => await context.Timesheets
            .AsNoTracking()
            .Where(t => t.Id == timesheetId)
            .Select(t => (Guid?)t.UserId)
            .SingleOrDefaultAsync(ct);

    public async Task<IReadOnlyList<ApprovalHistoryRow>> GetHistoryAsync(Guid timesheetId, CancellationToken ct = default)
        => (await context.ApprovalActions
            .AsNoTracking()
            .Where(x => x.TimesheetId == timesheetId)
            .OrderByDescending(x => x.ActionedAtUtc)
            .Select(x => new ApprovalHistoryDbRow(
                x.Id,
                x.TimesheetId,
                x.ManagerUserId,
                x.ManagerUser.Username,
                x.Action,
                x.Comment,
                x.ActionedAtUtc))
            .ToListAsync(ct))
            .Select(x => new ApprovalHistoryRow(
                x.Id,
                x.TimesheetId,
                x.ManagerUserId,
                x.ManagerUsername,
                x.Action.ToString().ToLowerInvariant(),
                x.Comment,
                x.ActionedAtUtc))
            .ToList();

    public async Task<ApprovalStatsRow> GetStatsAsync(Guid managerId, DateTime fromUtc, DateTime toUtc, CancellationToken ct = default)
    {
        var actionsInRange = await context.ApprovalActions
            .AsNoTracking()
            .Where(a => a.ManagerUserId == managerId && a.ActionedAtUtc >= fromUtc && a.ActionedAtUtc < toUtc)
            .Select(a => new { a.Action, a.ActionedAtUtc, a.TimesheetId })
            .ToListAsync(ct);

        var approved = actionsInRange.Count(a => a.Action == ApprovalActionType.Approved);
        var rejected = actionsInRange.Count(a => a.Action == ApprovalActionType.Rejected);
        if (actionsInRange.Count == 0)
            return new ApprovalStatsRow(approved, rejected, null);

        var timesheetIds = actionsInRange.Select(a => a.TimesheetId).Distinct().ToList();
        var submittedTimes = await context.Timesheets
            .AsNoTracking()
            .Where(t => timesheetIds.Contains(t.Id) && t.SubmittedAtUtc != null)
            .Select(t => new { t.Id, t.SubmittedAtUtc })
            .ToDictionaryAsync(t => t.Id, t => t.SubmittedAtUtc!.Value, ct);

        var matched = actionsInRange
            .Where(a => submittedTimes.ContainsKey(a.TimesheetId))
            .Select(a => (a.ActionedAtUtc - submittedTimes[a.TimesheetId]).TotalHours)
            .ToList();

        double? avgResponseHours = matched.Count > 0 ? Math.Round(matched.Average(), 1) : null;
        return new ApprovalStatsRow(approved, rejected, avgResponseHours);
    }

    private sealed record ApprovalHistoryDbRow(
        Guid Id,
        Guid TimesheetId,
        Guid ManagerUserId,
        string ManagerUsername,
        ApprovalActionType Action,
        string? Comment,
        DateTime ActionedAtUtc);
}

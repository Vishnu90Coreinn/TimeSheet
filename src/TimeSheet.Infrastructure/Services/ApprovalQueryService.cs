using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Enums;
using TimeSheet.Infrastructure.Persistence;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class ApprovalQueryService(TimeSheetDbContext context) : AppInterfaces.IApprovalQueryService
{
    public async Task<Guid?> GetTimesheetOwnerAsync(Guid timesheetId, CancellationToken ct = default)
        => await context.Timesheets
            .AsNoTracking()
            .Where(t => t.Id == timesheetId)
            .Select(t => (Guid?)t.UserId)
            .SingleOrDefaultAsync(ct);

    public async Task<List<AppInterfaces.ApprovalActionResult>> GetHistoryAsync(
        Guid timesheetId, CancellationToken ct = default)
        => await context.ApprovalActions
            .AsNoTracking()
            .Where(x => x.TimesheetId == timesheetId)
            .OrderByDescending(x => x.ActionedAtUtc)
            .Select(x => new AppInterfaces.ApprovalActionResult(
                x.Id,
                x.TimesheetId,
                x.ManagerUserId,
                x.ManagerUser.Username,
                x.Action.ToString().ToLowerInvariant(),
                x.Comment,
                x.ActionedAtUtc))
            .ToListAsync(ct);

    public async Task<AppInterfaces.ApprovalStatsResult> GetStatsAsync(
        Guid managerId, DateTime fromUtc, DateTime toUtc, CancellationToken ct = default)
    {
        var actionsInRange = await context.ApprovalActions
            .AsNoTracking()
            .Where(a => a.ManagerUserId == managerId
                && a.ActionedAtUtc >= fromUtc
                && a.ActionedAtUtc < toUtc)
            .ToListAsync(ct);

        var approved = actionsInRange.Count(a => a.Action == ApprovalActionType.Approved);
        var rejected = actionsInRange.Count(a => a.Action == ApprovalActionType.Rejected);

        var actionWithTs = await context.ApprovalActions
            .AsNoTracking()
            .Where(a => a.ManagerUserId == managerId
                && a.ActionedAtUtc >= fromUtc
                && a.ActionedAtUtc < toUtc)
            .Join(context.Timesheets, a => a.TimesheetId, t => t.Id,
                (a, t) => new { a.ActionedAtUtc, t.SubmittedAtUtc })
            .Where(x => x.SubmittedAtUtc != null)
            .ToListAsync(ct);

        double? avgResponseHours = actionWithTs.Count > 0
            ? Math.Round(actionWithTs.Average(x => (x.ActionedAtUtc - x.SubmittedAtUtc!.Value).TotalHours), 1)
            : null;

        return new AppInterfaces.ApprovalStatsResult(approved, rejected, avgResponseHours);
    }
}

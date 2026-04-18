using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class ApprovalQueryService(
    IApprovalReadRepository approvalReadRepository,
    ITimesheetRepository timesheetRepository,
    IApprovalDelegationRepository delegationRepository) : AppInterfaces.IApprovalQueryService
{
    public async Task<Guid?> GetTimesheetOwnerAsync(Guid timesheetId, CancellationToken ct = default)
        => await approvalReadRepository.GetTimesheetOwnerAsync(timesheetId, ct);

    public async Task<List<AppInterfaces.ApprovalActionResult>> GetHistoryAsync(Guid timesheetId, CancellationToken ct = default)
        => (await approvalReadRepository.GetHistoryAsync(timesheetId, ct))
            .Select(x => new AppInterfaces.ApprovalActionResult(
                x.Id,
                x.TimesheetId,
                x.ManagerUserId,
                x.ManagerUsername,
                x.Action,
                x.Comment,
                x.ActionedAtUtc))
            .ToList();

    public async Task<AppInterfaces.ApprovalStatsResult> GetStatsAsync(Guid managerId, DateTime fromUtc, DateTime toUtc, CancellationToken ct = default)
    {
        var stats = await approvalReadRepository.GetStatsAsync(managerId, fromUtc, toUtc, ct);
        return new AppInterfaces.ApprovalStatsResult(stats.ApprovedThisMonth, stats.RejectedThisMonth, stats.AvgResponseHours);
    }

    public async Task<PagedResult<AppInterfaces.PendingApprovalTimesheetResult>> GetPendingTimesheetsPageAsync(
        Guid managerId,
        string? search,
        bool? hasMismatch,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var managerIds = new HashSet<Guid> { managerId };

        var activeDelegations = await delegationRepository.GetActiveDelegationsForDelegateAsync(managerId, ct);
        foreach (var delegation in activeDelegations)
            managerIds.Add(delegation.FromUserId);

        var (rows, totalCount, effectivePage) = await timesheetRepository.GetPendingForManagersPageAsync(
            managerIds.ToList(),
            search,
            hasMismatch,
            sortBy,
            descending,
            page,
            pageSize,
            ct);

        var delegatedByManagerId = activeDelegations
            .Where(d => d.FromUser is not null)
            .ToDictionary(d => d.FromUserId, d => d.FromUser.Username);

        var items = rows.Select(r => new AppInterfaces.PendingApprovalTimesheetResult(
            r.TimesheetId,
            r.UserId,
            r.Username,
            r.DisplayName,
            r.WorkDate,
            r.EnteredMinutes,
            r.Status,
            r.SubmittedAtUtc,
            r.HasMismatch,
            r.MismatchReason,
            r.ManagerId.HasValue && delegatedByManagerId.TryGetValue(r.ManagerId.Value, out var delegatedFrom)
                ? delegatedFrom
                : null)).ToList();

        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));

        return new PagedResult<AppInterfaces.PendingApprovalTimesheetResult>(
            items,
            effectivePage,
            pageSize,
            totalCount,
            totalPages,
            sortBy,
            descending ? "desc" : "asc");
    }
}

using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class LeaveReadRepository(TimeSheetDbContext context) : ILeaveReadRepository
{
    public async Task<IReadOnlyList<LeaveTypeReadRow>> GetLeaveTypesAsync(bool activeOnly, CancellationToken ct = default)
    {
        var query = context.LeaveTypes.AsNoTracking();
        if (activeOnly)
            query = query.Where(x => x.IsActive);

        return await query
            .OrderBy(x => x.Name)
            .Select(x => new LeaveTypeReadRow(x.Id, x.Name, x.IsActive))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<PagedLeaveRequestRow>> GetMyRequestsAsync(Guid userId, CancellationToken ct = default)
    {
        var rows = await context.LeaveRequests
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.LeaveDate)
            .Select(x => new LeaveRequestReadDbRow(
                x.Id,
                x.UserId,
                x.User.Username,
                x.LeaveDate,
                x.LeaveTypeId,
                x.LeaveType.Name,
                x.IsHalfDay,
                x.Status,
                x.Comment,
                x.ReviewedByUserId,
                x.ReviewedByUser != null ? x.ReviewedByUser.Username : null,
                x.ReviewerComment,
                x.CreatedAtUtc,
                x.ReviewedAtUtc))
            .ToListAsync(ct);

        return rows.Select(MapLeaveRequest).ToList();
    }

    public async Task<IReadOnlyList<LeaveGroupReadRow>> GetMyGroupedRequestsAsync(Guid userId, CancellationToken ct = default)
    {
        var leaveRequests = await context.LeaveRequests
            .AsNoTracking()
            .Include(lr => lr.LeaveType)
            .Include(lr => lr.ReviewedByUser)
            .Where(lr => lr.UserId == userId)
            .OrderBy(lr => lr.LeaveDate)
            .ToListAsync(ct);

        return leaveRequests
            .GroupBy(lr => lr.LeaveGroupId ?? lr.Id)
            .Select(g =>
            {
                var first = g.First();
                return new LeaveGroupReadRow(
                    g.Key,
                    first.LeaveType.Name,
                    g.Min(r => r.LeaveDate),
                    g.Max(r => r.LeaveDate),
                    g.Count(),
                    first.Status.ToString().ToLowerInvariant(),
                    DateOnly.FromDateTime(first.CreatedAtUtc),
                    first.ReviewedByUser?.Username,
                    first.Comment);
            })
            .OrderByDescending(g => g.FromDate)
            .ToList();
    }

    public async Task<IReadOnlyList<LeaveBalanceReadRow>> GetBalancesAsync(Guid userId, int year, CancellationToken ct = default)
    {
        var leaveTypes = await context.LeaveTypes
            .AsNoTracking()
            .Where(lt => lt.IsActive)
            .OrderBy(lt => lt.Name)
            .ToListAsync(ct);

        var policyAllocations = await context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId && u.LeavePolicyId != null)
            .SelectMany(u => u.LeavePolicy!.Allocations)
            .ToListAsync(ct);

        var manualAdjustments = await context.LeaveBalances
            .AsNoTracking()
            .Where(lb => lb.UserId == userId && lb.Year == year)
            .ToListAsync(ct);

        var usedByType = await context.LeaveRequests
            .AsNoTracking()
            .Where(lr => lr.UserId == userId && lr.LeaveDate.Year == year && lr.Status == LeaveRequestStatus.Approved)
            .GroupBy(lr => lr.LeaveTypeId)
            .Select(g => new { LeaveTypeId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return leaveTypes.Select(lt =>
        {
            var policyAlloc = policyAllocations.FirstOrDefault(a => a.LeaveTypeId == lt.Id);
            var manual = manualAdjustments.FirstOrDefault(b => b.LeaveTypeId == lt.Id);
            var used = usedByType.FirstOrDefault(u => u.LeaveTypeId == lt.Id)?.Count ?? 0;
            var total = (policyAlloc?.DaysPerYear ?? 0) + (manual?.ManualAdjustmentDays ?? 0);
            return new LeaveBalanceReadRow(lt.Id, lt.Name, total, used, Math.Max(0, total - used));
        }).ToList();
    }

    public async Task<IReadOnlyList<LeavePolicyReadRow>> GetPoliciesAsync(CancellationToken ct = default)
        => (await context.LeavePolicies
            .AsNoTracking()
            .Include(p => p.Allocations)
                .ThenInclude(a => a.LeaveType)
            .OrderBy(p => p.Name)
            .ToListAsync(ct))
            .Select(p => new LeavePolicyReadRow(
                p.Id,
                p.Name,
                p.IsActive,
                p.Allocations.Select(a => new PagedLeavePolicyAllocationRow(a.LeaveTypeId, a.LeaveType.Name, a.DaysPerYear)).ToList()))
            .ToList();

    public async Task<IReadOnlyList<PagedLeaveRequestRow>> GetPendingForManagerAsync(Guid managerId, bool isAdmin, CancellationToken ct = default)
    {
        var query = context.LeaveRequests.AsNoTracking().Where(x => x.Status == LeaveRequestStatus.Pending);
        if (!isAdmin)
            query = query.Where(x => x.User.ManagerId == managerId);

        var rows = await query
            .OrderBy(x => x.LeaveDate)
            .Select(x => new LeaveRequestReadDbRow(
                x.Id,
                x.UserId,
                x.User.Username,
                x.LeaveDate,
                x.LeaveTypeId,
                x.LeaveType.Name,
                x.IsHalfDay,
                x.Status,
                x.Comment,
                x.ReviewedByUserId,
                x.ReviewedByUser != null ? x.ReviewedByUser.Username : null,
                x.ReviewerComment,
                x.CreatedAtUtc,
                x.ReviewedAtUtc))
            .ToListAsync(ct);

        return rows.Select(MapLeaveRequest).ToList();
    }

    private static PagedLeaveRequestRow MapLeaveRequest(LeaveRequestReadDbRow row)
        => new(
            row.Id,
            row.UserId,
            row.Username,
            row.LeaveDate,
            row.LeaveTypeId,
            row.LeaveTypeName,
            row.IsHalfDay,
            row.Status.ToString().ToLowerInvariant(),
            row.Comment,
            row.ReviewedByUserId,
            row.ReviewedByUsername,
            row.ReviewerComment,
            row.CreatedAtUtc,
            row.ReviewedAtUtc);

    private sealed record LeaveRequestReadDbRow(
        Guid Id,
        Guid UserId,
        string Username,
        DateOnly LeaveDate,
        Guid LeaveTypeId,
        string LeaveTypeName,
        bool IsHalfDay,
        LeaveRequestStatus Status,
        string? Comment,
        Guid? ReviewedByUserId,
        string? ReviewedByUsername,
        string? ReviewerComment,
        DateTime CreatedAtUtc,
        DateTime? ReviewedAtUtc);
}

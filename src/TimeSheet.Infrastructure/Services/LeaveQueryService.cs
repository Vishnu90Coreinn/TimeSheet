using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Enums;
using TimeSheet.Infrastructure.Persistence;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class LeaveQueryService(TimeSheetDbContext context) : AppInterfaces.ILeaveQueryService
{
    public async Task<List<AppInterfaces.LeaveTypeResult>> GetLeaveTypesAsync(bool activeOnly, CancellationToken ct = default)
    {
        var query = context.LeaveTypes.AsNoTracking();
        if (activeOnly)
            query = query.Where(x => x.IsActive);

        return await query
            .OrderBy(x => x.Name)
            .Select(x => new AppInterfaces.LeaveTypeResult(x.Id, x.Name, x.IsActive))
            .ToListAsync(ct);
    }

    public async Task<List<AppInterfaces.LeaveRequestResult>> GetMyRequestsAsync(Guid userId, CancellationToken ct = default)
    {
        return await context.LeaveRequests
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.LeaveDate)
            .Select(x => new AppInterfaces.LeaveRequestResult(
                x.Id,
                x.UserId,
                x.User.Username,
                x.LeaveDate,
                x.LeaveTypeId,
                x.LeaveType.Name,
                x.IsHalfDay,
                x.Status.ToString().ToLowerInvariant(),
                x.Comment,
                x.ReviewedByUserId,
                x.ReviewedByUser != null ? x.ReviewedByUser.Username : null,
                x.ReviewerComment,
                x.CreatedAtUtc,
                x.ReviewedAtUtc))
            .ToListAsync(ct);
    }

    public async Task<List<AppInterfaces.LeaveGroupResult>> GetMyGroupedRequestsAsync(Guid userId, CancellationToken ct = default)
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
                return new AppInterfaces.LeaveGroupResult(
                    GroupId: g.Key,
                    LeaveTypeName: first.LeaveType.Name,
                    FromDate: g.Min(r => r.LeaveDate),
                    ToDate: g.Max(r => r.LeaveDate),
                    Days: g.Count(),
                    Status: first.Status.ToString().ToLower(),
                    AppliedOnDate: DateOnly.FromDateTime(first.CreatedAtUtc),
                    ApprovedByUsername: first.ReviewedByUser?.Username,
                    Comment: first.Comment
                );
            })
            .OrderByDescending(g => g.FromDate)
            .ToList();
    }

    public async Task<List<AppInterfaces.LeaveBalanceResult>> GetBalanceAsync(Guid userId, int year, CancellationToken ct = default)
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
            .Where(lr => lr.UserId == userId
                && lr.LeaveDate.Year == year
                && lr.Status == LeaveRequestStatus.Approved)
            .GroupBy(lr => lr.LeaveTypeId)
            .Select(g => new { LeaveTypeId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return leaveTypes.Select(lt =>
        {
            var policyAlloc = policyAllocations.FirstOrDefault(a => a.LeaveTypeId == lt.Id);
            var manual = manualAdjustments.FirstOrDefault(b => b.LeaveTypeId == lt.Id);
            var used = usedByType.FirstOrDefault(u => u.LeaveTypeId == lt.Id)?.Count ?? 0;
            var total = (policyAlloc?.DaysPerYear ?? 0) + (manual?.ManualAdjustmentDays ?? 0);
            return new AppInterfaces.LeaveBalanceResult(lt.Id, lt.Name, total, used, Math.Max(0, total - used));
        }).ToList();
    }

    public async Task<List<AppInterfaces.LeavePolicyResult>> GetPoliciesAsync(CancellationToken ct = default)
    {
        var policies = await context.LeavePolicies
            .AsNoTracking()
            .Include(p => p.Allocations)
                .ThenInclude(a => a.LeaveType)
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

        return policies.Select(p => new AppInterfaces.LeavePolicyResult(
            p.Id,
            p.Name,
            p.IsActive,
            p.Allocations
                .Select(a => new AppInterfaces.LeavePolicyAllocationResult(a.LeaveTypeId, a.LeaveType.Name, a.DaysPerYear))
                .ToList()
        )).ToList();
    }

    public async Task<List<AppInterfaces.LeaveRequestResult>> GetPendingForManagerAsync(Guid managerId, bool isAdmin, CancellationToken ct = default)
    {
        var query = context.LeaveRequests
            .AsNoTracking()
            .Where(x => x.Status == LeaveRequestStatus.Pending);

        if (!isAdmin)
            query = query.Where(x => x.User.ManagerId == managerId);

        return await query
            .OrderBy(x => x.LeaveDate)
            .Select(x => new AppInterfaces.LeaveRequestResult(
                x.Id,
                x.UserId,
                x.User.Username,
                x.LeaveDate,
                x.LeaveTypeId,
                x.LeaveType.Name,
                x.IsHalfDay,
                x.Status.ToString().ToLowerInvariant(),
                x.Comment,
                x.ReviewedByUserId,
                x.ReviewedByUser != null ? x.ReviewedByUser.Username : null,
                x.ReviewerComment,
                x.CreatedAtUtc,
                x.ReviewedAtUtc))
            .ToListAsync(ct);
    }
}

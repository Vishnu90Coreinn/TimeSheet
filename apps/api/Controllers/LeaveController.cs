using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Extensions;
using TimeSheet.Application.Leave.Commands;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/leave")]
public class LeaveController(TimeSheetDbContext dbContext, IAuditService auditService, INotificationService notificationService, ISender mediator) : ControllerBase
{
    [HttpGet("types")]
    public async Task<IActionResult> GetLeaveTypes()
    {
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "employee";
        var query = dbContext.LeaveTypes.AsNoTracking();
        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x => x.IsActive);
        }

        var items = await query.OrderBy(x => x.Name)
            .Select(x => new LeaveTypeResponse(x.Id, x.Name, x.IsActive))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("types")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpsertLeaveType([FromBody] UpsertLeaveTypeRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        var existing = await dbContext.LeaveTypes.SingleOrDefaultAsync(x => x.Name == name);
        if (existing is null)
        {
            existing = new LeaveType { Id = Guid.NewGuid(), Name = name, IsActive = request.IsActive };
            dbContext.LeaveTypes.Add(existing);
        }
        else
        {
            existing.IsActive = request.IsActive;
        }

        await dbContext.SaveChangesAsync();
        return Ok(new LeaveTypeResponse(existing.Id, existing.Name, existing.IsActive));
    }

    [HttpPost("requests")]
    public async Task<IActionResult> ApplyLeave([FromBody] ApplyLeaveRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(
            new ApplyLeaveCommand(request.FromDate, request.ToDate, request.LeaveTypeId, request.IsHalfDay, request.Comment), ct);
        if (!result.IsSuccess) return result.ToActionResult();
        return Ok(new { leaveGroupId = result.Value!.LeaveGroupId, count = result.Value.Count });
    }

    [HttpDelete("requests/{id:guid}")]
    public async Task<IActionResult> CancelLeave(Guid id)
    {
        var result = await mediator.Send(new CancelLeaveCommand(id));
        return result.ToActionResult();
    }

    [HttpGet("requests/my")]
    public async Task<IActionResult> GetMyLeaveRequests()
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var items = await dbContext.LeaveRequests
            .AsNoTracking()
            .Where(x => x.UserId == userId.Value)
            .OrderByDescending(x => x.LeaveDate)
            .Select(x => new LeaveRequestResponse(
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
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("requests/pending")]
    [Authorize(Roles = "manager,admin")]
    public async Task<IActionResult> GetPendingLeaveRequests()
    {
        var managerId = GetUserId();
        if (managerId is null)
        {
            return Unauthorized();
        }

        var role = User.FindFirstValue(ClaimTypes.Role) ?? "employee";
        var query = dbContext.LeaveRequests.AsNoTracking().Where(x => x.Status == LeaveRequestStatus.Pending);

        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x => x.User.ManagerId == managerId.Value);
        }

        var items = await query
            .OrderBy(x => x.LeaveDate)
            .Select(x => new LeaveRequestResponse(
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
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("requests/{leaveRequestId:guid}/review")]
    [Authorize(Roles = "manager,admin")]
    public async Task<IActionResult> ReviewLeave(Guid leaveRequestId, [FromBody] ReviewLeaveRequest request)
    {
        var result = await mediator.Send(new ReviewLeaveCommand(leaveRequestId, request.Approve, request.Comment));
        return result.ToActionResult();
    }

    // ── Leave Policies (admin only) ───────────────────────────────

    [HttpGet("policies")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetPolicies()
    {
        var policies = await dbContext.LeavePolicies
            .Include(p => p.Allocations)
                .ThenInclude(a => a.LeaveType)
            .OrderBy(p => p.Name)
            .ToListAsync();

        var result = policies.Select(p => new LeavePolicyResponse(
            p.Id, p.Name, p.IsActive,
            p.Allocations.Select(a => new LeavePolicyAllocationResponse(a.LeaveTypeId, a.LeaveType.Name, a.DaysPerYear)).ToList()
        ));
        return Ok(result);
    }

    [HttpPost("policies")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreatePolicy([FromBody] UpsertLeavePolicyRequest request)
    {
        var policy = new LeavePolicy { Id = Guid.NewGuid(), Name = request.Name, IsActive = request.IsActive };
        policy.Allocations = request.Allocations.Select(a => new LeavePolicyAllocation
        {
            Id = Guid.NewGuid(),
            LeavePolicyId = policy.Id,
            LeaveTypeId = a.LeaveTypeId,
            DaysPerYear = a.DaysPerYear
        }).ToList();
        dbContext.LeavePolicies.Add(policy);
        await dbContext.SaveChangesAsync();
        return CreatedAtAction(nameof(GetPolicies), new { id = policy.Id }, new { id = policy.Id });
    }

    [HttpPut("policies/{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdatePolicy(Guid id, [FromBody] UpsertLeavePolicyRequest request)
    {
        var policy = await dbContext.LeavePolicies.Include(p => p.Allocations).FirstOrDefaultAsync(p => p.Id == id);
        if (policy is null) return NotFound();

        policy.Name = request.Name;
        policy.IsActive = request.IsActive;

        // Replace allocations
        dbContext.LeavePolicyAllocations.RemoveRange(policy.Allocations);
        policy.Allocations = request.Allocations.Select(a => new LeavePolicyAllocation
        {
            Id = Guid.NewGuid(),
            LeavePolicyId = policy.Id,
            LeaveTypeId = a.LeaveTypeId,
            DaysPerYear = a.DaysPerYear
        }).ToList();

        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("policies/{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeletePolicy(Guid id)
    {
        var policy = await dbContext.LeavePolicies.FindAsync(id);
        if (policy is null) return NotFound();
        dbContext.LeavePolicies.Remove(policy);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    // ── Leave Balance ─────────────────────────────────────────────

    [HttpGet("balance/my")]
    public async Task<IActionResult> GetMyBalance()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var year = DateTime.UtcNow.Year;
        return Ok(await ComputeBalances(userId.Value, year));
    }

    [HttpGet("balance/{userId:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetUserBalance(Guid userId)
    {
        var year = DateTime.UtcNow.Year;
        return Ok(await ComputeBalances(userId, year));
    }

    [HttpPut("balance/{userId:guid}/{leaveTypeId:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdjustBalance(Guid userId, Guid leaveTypeId, [FromBody] AdjustLeaveBalanceRequest request)
    {
        var year = DateTime.UtcNow.Year;
        var balance = await dbContext.LeaveBalances
            .FirstOrDefaultAsync(lb => lb.UserId == userId && lb.LeaveTypeId == leaveTypeId && lb.Year == year);

        if (balance is null)
        {
            balance = new LeaveBalance { Id = Guid.NewGuid(), UserId = userId, LeaveTypeId = leaveTypeId, Year = year };
            dbContext.LeaveBalances.Add(balance);
        }

        balance.ManualAdjustmentDays += request.Adjustment;
        balance.Note = request.Note;
        balance.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
        return Ok(await ComputeBalances(userId, year));
    }

    // ── Leave History (grouped) ───────────────────────────────────

    [HttpGet("requests/my/grouped")]
    public async Task<IActionResult> GetMyGroupedRequests()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var leaveRequests = await dbContext.LeaveRequests
            .Include(lr => lr.LeaveType)
            .Include(lr => lr.ReviewedByUser)
            .Where(lr => lr.UserId == userId.Value)
            .OrderBy(lr => lr.LeaveDate)
            .ToListAsync();

        // Group by LeaveGroupId (fall back to individual records for legacy data with no group)
        var groups = leaveRequests
            .GroupBy(lr => lr.LeaveGroupId ?? lr.Id)
            .Select(g =>
            {
                var first = g.First();
                return new LeaveRequestGroupResponse(
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

        return Ok(groups);
    }

    // ── Leave Calendar ────────────────────────────────────────────

    [HttpGet("calendar")]
    public async Task<IActionResult> GetCalendar([FromQuery] int year, [FromQuery] int month)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var leaveRequests = await dbContext.LeaveRequests
            .Where(lr => lr.UserId == userId.Value
                && lr.LeaveDate.Year == year
                && lr.LeaveDate.Month == month)
            .Select(lr => new { lr.LeaveDate, lr.Status })
            .ToListAsync();

        var result = leaveRequests.Select(r => new LeaveCalendarDay(
            r.LeaveDate,
            r.Status == LeaveRequestStatus.Approved ? "approved"
                : r.Status == LeaveRequestStatus.Rejected ? "rejected"
                : "pending"
        ));

        return Ok(result);
    }

    // ── Team Leave Calendar ───────────────────────────────────────

    [HttpGet("team-calendar")]
    public async Task<IActionResult> GetTeamCalendar([FromQuery] int? year, [FromQuery] int? month)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var now = DateTime.UtcNow;
        var y = year ?? now.Year;
        var m = month ?? now.Month;

        var role = User.FindFirstValue(ClaimTypes.Role) ?? "employee";
        var currentUser = await dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
        if (currentUser is null) return Ok(Array.Empty<TeamLeaveCalendarDay>());

        List<Guid> teamUserIds;
        if (string.Equals(role, "manager", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            // manager/admin: direct reports + themselves
            teamUserIds = await dbContext.Users
                .AsNoTracking()
                .Where(u => u.IsActive && (u.ManagerId == userId.Value || u.Id == userId.Value))
                .Select(u => u.Id)
                .ToListAsync();
        }
        else
        {
            // employee: same department (including themselves)
            if (currentUser.DepartmentId is null)
                return Ok(Array.Empty<TeamLeaveCalendarDay>());

            teamUserIds = await dbContext.Users
                .AsNoTracking()
                .Where(u => u.IsActive && u.DepartmentId == currentUser.DepartmentId)
                .Select(u => u.Id)
                .ToListAsync();
        }

        if (teamUserIds.Count == 0)
            return Ok(Array.Empty<TeamLeaveCalendarDay>());

        var requests = await dbContext.LeaveRequests
            .AsNoTracking()
            .Include(lr => lr.User)
            .Include(lr => lr.LeaveType)
            .Where(lr => teamUserIds.Contains(lr.UserId)
                && lr.LeaveDate.Year == y
                && lr.LeaveDate.Month == m
                && lr.Status != LeaveRequestStatus.Rejected)
            .OrderBy(lr => lr.LeaveDate)
            .ToListAsync();

        var grouped = requests
            .GroupBy(lr => lr.LeaveDate)
            .Select(g => new TeamLeaveCalendarDay(
                g.Key,
                g.Select(lr => new TeamLeaveEntry(
                    lr.UserId,
                    lr.User.Username,
                    lr.User.DisplayName,
                    lr.LeaveType.Name,
                    lr.Status.ToString().ToLowerInvariant()
                )).ToList()
            ))
            .OrderBy(d => d.Date)
            .ToList();

        return Ok(grouped);
    }

    [HttpGet("conflicts")]
    public async Task<IActionResult> GetConflicts([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate, [FromQuery] Guid? userId)
    {
        var currentUserId = GetUserId();
        if (currentUserId is null) return Unauthorized();

        var targetUserId = userId ?? currentUserId.Value;

        var role = User.FindFirstValue(ClaimTypes.Role) ?? "employee";
        var currentUser = await dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == currentUserId.Value);
        if (currentUser is null) return Ok(new LeaveConflictResponse(0, Array.Empty<string>()));

        List<Guid> teamUserIds;
        if (string.Equals(role, "manager", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            teamUserIds = await dbContext.Users
                .AsNoTracking()
                .Where(u => u.IsActive && (u.ManagerId == currentUserId.Value || u.Id == currentUserId.Value))
                .Select(u => u.Id)
                .ToListAsync();
        }
        else
        {
            if (currentUser.DepartmentId is null)
                return Ok(new LeaveConflictResponse(0, Array.Empty<string>()));

            teamUserIds = await dbContext.Users
                .AsNoTracking()
                .Where(u => u.IsActive && u.DepartmentId == currentUser.DepartmentId)
                .Select(u => u.Id)
                .ToListAsync();
        }

        // Exclude the target user themselves
        teamUserIds = teamUserIds.Where(id => id != targetUserId).ToList();

        if (teamUserIds.Count == 0)
            return Ok(new LeaveConflictResponse(0, Array.Empty<string>()));

        var conflictingUsers = await dbContext.LeaveRequests
            .AsNoTracking()
            .Include(lr => lr.User)
            .Where(lr => teamUserIds.Contains(lr.UserId)
                && lr.LeaveDate >= fromDate
                && lr.LeaveDate <= toDate
                && lr.Status != LeaveRequestStatus.Rejected)
            .Select(lr => new { lr.UserId, lr.User.Username })
            .Distinct()
            .ToListAsync();

        var distinct = conflictingUsers
            .GroupBy(x => x.UserId)
            .Select(g => g.First().Username)
            .ToList();

        return Ok(new LeaveConflictResponse(distinct.Count, distinct.Take(5).ToList()));
    }

    // ── Team on Leave ─────────────────────────────────────────────

    [HttpGet("team-on-leave")]
    public async Task<IActionResult> GetTeamOnLeave()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var window = today.AddDays(14);

        // Get teammates: users who share the same manager OR are direct reports
        var currentUser = await dbContext.Users.FindAsync(userId.Value);
        if (currentUser is null) return Ok(Array.Empty<object>());

        var teamUserIds = await dbContext.Users
            .Where(u => u.Id != userId.Value && u.IsActive &&
                        (u.ManagerId == currentUser.ManagerId || u.ManagerId == userId.Value))
            .Select(u => u.Id)
            .ToListAsync();

        if (teamUserIds.Count == 0) return Ok(Array.Empty<object>());

        var teamRequests = await dbContext.LeaveRequests
            .Include(lr => lr.User)
            .Include(lr => lr.LeaveType)
            .Where(lr => teamUserIds.Contains(lr.UserId)
                && lr.LeaveDate >= today
                && lr.LeaveDate <= window
                && lr.Status != LeaveRequestStatus.Rejected)
            .OrderBy(lr => lr.LeaveDate)
            .ToListAsync();

        var grouped = teamRequests
            .GroupBy(lr => new { lr.UserId, GroupKey = lr.LeaveGroupId ?? lr.Id, lr.LeaveType.Name })
            .Select(g =>
            {
                var first = g.First();
                return new TeamLeaveEntryResponse(
                    UserId: first.UserId,
                    Username: first.User.Username,
                    FromDate: g.Min(r => r.LeaveDate),
                    ToDate: g.Max(r => r.LeaveDate),
                    LeaveTypeName: first.LeaveType.Name,
                    Status: g.Min(r => r.LeaveDate) <= today ? "away" : "upcoming"
                );
            })
            .ToList();

        return Ok(grouped);
    }

    // ── Private helper ────────────────────────────────────────────

    private async Task<LeaveBalanceResponse[]> ComputeBalances(Guid userId, int year)
    {
        var leaveTypes = await dbContext.LeaveTypes.Where(lt => lt.IsActive).OrderBy(lt => lt.Name).ToListAsync();

        // Policy allocations give the base entitlement (DaysPerYear)
        var policyAllocations = await dbContext.Users
            .Where(u => u.Id == userId && u.LeavePolicyId != null)
            .SelectMany(u => u.LeavePolicy!.Allocations)
            .ToListAsync();

        // Manual adjustments stored per-user per-year (admin overrides)
        var manualAdjustments = await dbContext.LeaveBalances
            .Where(lb => lb.UserId == userId && lb.Year == year)
            .ToListAsync();

        var usedByType = await dbContext.LeaveRequests
            .Where(lr => lr.UserId == userId
                && lr.LeaveDate.Year == year
                && lr.Status == LeaveRequestStatus.Approved)
            .GroupBy(lr => lr.LeaveTypeId)
            .Select(g => new { LeaveTypeId = g.Key, Count = g.Count() })
            .ToListAsync();

        return leaveTypes.Select(lt =>
        {
            var policyAlloc = policyAllocations.FirstOrDefault(a => a.LeaveTypeId == lt.Id);
            var manual = manualAdjustments.FirstOrDefault(b => b.LeaveTypeId == lt.Id);
            var used = usedByType.FirstOrDefault(u => u.LeaveTypeId == lt.Id)?.Count ?? 0;
            var total = (policyAlloc?.DaysPerYear ?? 0) + (manual?.ManualAdjustmentDays ?? 0);
            return new LeaveBalanceResponse(lt.Id, lt.Name, total, used, Math.Max(0, total - used));
        }).ToArray();
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(sub, out var userId) ? userId : null;
    }

    private async Task<LeaveRequestResponse> MapLeaveResponse(Guid id)
    {
        return await dbContext.LeaveRequests.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new LeaveRequestResponse(
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
            .SingleAsync();
    }
}

using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Extensions;
using TimeSheet.Application.Leave.Commands;
using TimeSheet.Application.Leave.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/leave")]
public class LeaveController(TimeSheetDbContext dbContext, ISender mediator) : ControllerBase
{
    [HttpGet("types")]
    public async Task<IActionResult> GetLeaveTypes(CancellationToken ct)
    {
        var isAdmin = User.IsInRole("admin");
        var result = await mediator.Send(new GetLeaveTypesQuery(!isAdmin), ct);
        return result.IsSuccess ? Ok(result.Value) : result.ToActionResult();
    }

    [HttpPost("types")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpsertLeaveType([FromBody] UpsertLeaveTypeRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new UpsertLeaveTypeCommand(null, request.Name, request.IsActive), ct);
        return result.ToActionResult();
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
    public async Task<IActionResult> GetMyLeaveRequests(CancellationToken ct)
    {
        var result = await mediator.Send(new GetMyLeaveRequestsQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : result.ToActionResult();
    }

    [HttpGet("requests/pending")]
    [Authorize(Roles = "manager,admin")]
    public async Task<IActionResult> GetPendingLeaveRequests(CancellationToken ct)
    {
        var result = await mediator.Send(new GetPendingLeaveRequestsQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : result.ToActionResult();
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
    public async Task<IActionResult> GetPolicies(CancellationToken ct)
    {
        var result = await mediator.Send(new GetLeavePoliciesQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : result.ToActionResult();
    }

    [HttpPost("policies")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreatePolicy([FromBody] UpsertLeavePolicyRequest request, CancellationToken ct)
    {
        var allocations = request.Allocations
            .Select(a => new LeavePolicyAllocationDto(a.LeaveTypeId, a.DaysPerYear))
            .ToList();
        var result = await mediator.Send(new CreateLeavePolicyCommand(request.Name, request.IsActive, allocations), ct);
        if (!result.IsSuccess) return result.ToActionResult();
        return CreatedAtAction(nameof(GetPolicies), new { id = result.Value }, new { id = result.Value });
    }

    [HttpPut("policies/{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdatePolicy(Guid id, [FromBody] UpsertLeavePolicyRequest request, CancellationToken ct)
    {
        var allocations = request.Allocations
            .Select(a => new LeavePolicyAllocationDto(a.LeaveTypeId, a.DaysPerYear))
            .ToList();
        var result = await mediator.Send(new UpdateLeavePolicyCommand(id, request.Name, request.IsActive, allocations), ct);
        return result.ToActionResult();
    }

    [HttpDelete("policies/{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeletePolicy(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteLeavePolicyCommand(id), ct);
        return result.ToActionResult();
    }

    // ── Leave Balance ─────────────────────────────────────────────

    [HttpGet("balance/my")]
    public async Task<IActionResult> GetMyBalance(CancellationToken ct)
    {
        var result = await mediator.Send(new GetLeaveBalanceQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : result.ToActionResult();
    }

    [HttpGet("balance/{userId:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetUserBalance(Guid userId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetLeaveBalanceQuery(userId), ct);
        return result.IsSuccess ? Ok(result.Value) : result.ToActionResult();
    }

    [HttpPut("balance/{userId:guid}/{leaveTypeId:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdjustBalance(Guid userId, Guid leaveTypeId, [FromBody] AdjustLeaveBalanceRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateLeaveBalanceCommand(userId, leaveTypeId, request.Adjustment, request.Note), ct);
        if (!result.IsSuccess) return result.ToActionResult();
        var balanceResult = await mediator.Send(new GetLeaveBalanceQuery(userId), ct);
        return balanceResult.IsSuccess ? Ok(balanceResult.Value) : balanceResult.ToActionResult();
    }

    [HttpGet("comp-off-balance")]
    public async Task<IActionResult> GetCompOffBalance(CancellationToken ct)
    {
        var result = await mediator.Send(new GetCompOffBalanceQuery(), ct);
        if (!result.IsSuccess) return result.ToActionResult();

        var v = result.Value!;
        return Ok(new CompOffBalanceResponse(v.Credits, v.Hours, v.NextExpiryAtUtc));
    }

    // ── Leave History (grouped) ───────────────────────────────────

    [HttpGet("requests/my/grouped")]
    public async Task<IActionResult> GetMyGroupedRequests(CancellationToken ct)
    {
        var result = await mediator.Send(new GetMyGroupedLeaveQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : result.ToActionResult();
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

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(sub, out var userId) ? userId : null;
    }
}

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Services;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "manager,admin")]
[Route("api/v1/approvals")]
public class ApprovalsController(TimeSheetDbContext dbContext, IAuditService auditService, INotificationService notificationService) : ControllerBase
{
    [HttpGet("pending-timesheets")]
    public async Task<IActionResult> GetPendingTimesheets()
    {
        var managerId = GetUserId();
        if (managerId is null)
        {
            return Unauthorized();
        }

        var role = User.FindFirstValue(ClaimTypes.Role) ?? "employee";
        var query = dbContext.Timesheets
            .AsNoTracking()
            .Where(t => t.Status == TimesheetStatus.Submitted);

        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(t => t.User.ManagerId == managerId.Value);
        }

        var items = await query
            .OrderBy(t => t.WorkDate)
            .Select(t => new TimesheetApprovalListItem(
                t.Id,
                t.UserId,
                t.User.Username,
                t.WorkDate,
                t.Entries.Sum(e => e.Minutes),
                t.Status.ToString().ToLowerInvariant(),
                t.SubmittedAtUtc,
                t.MismatchReason != null,
                t.MismatchReason))
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("history/{timesheetId:guid}")]
    [Authorize]
    public async Task<IActionResult> GetApprovalHistory(Guid timesheetId)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var role = User.FindFirstValue(ClaimTypes.Role) ?? "employee";
        var timesheet = await dbContext.Timesheets.AsNoTracking().SingleOrDefaultAsync(x => x.Id == timesheetId);
        if (timesheet is null)
        {
            return NotFound();
        }

        var isManagerOrAdmin = string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(role, "manager", StringComparison.OrdinalIgnoreCase);
        var canView = timesheet.UserId == userId.Value || isManagerOrAdmin;
        if (!canView)
        {
            return Forbid();
        }

        var history = await dbContext.ApprovalActions
            .AsNoTracking()
            .Where(x => x.TimesheetId == timesheetId)
            .OrderByDescending(x => x.ActionedAtUtc)
            .Select(x => new ApprovalActionResponse(
                x.Id,
                x.TimesheetId,
                x.ManagerUserId,
                x.ManagerUser.Username,
                x.Action.ToString().ToLowerInvariant(),
                x.Comment,
                x.ActionedAtUtc))
            .ToListAsync();

        return Ok(history);
    }

    [HttpPost("timesheets/{timesheetId:guid}/approve")]
    public async Task<IActionResult> Approve(Guid timesheetId, [FromBody] TimesheetDecisionRequest request)
    {
        return await Decide(timesheetId, ApprovalActionType.Approved, TimesheetStatus.Approved, request.Comment, false);
    }

    [HttpPost("timesheets/{timesheetId:guid}/reject")]
    public async Task<IActionResult> Reject(Guid timesheetId, [FromBody] TimesheetDecisionRequest request)
    {
        return await Decide(timesheetId, ApprovalActionType.Rejected, TimesheetStatus.Rejected, request.Comment, true);
    }

    [HttpPost("timesheets/{timesheetId:guid}/push-back")]
    public async Task<IActionResult> PushBack(Guid timesheetId, [FromBody] TimesheetDecisionRequest request)
    {
        return await Decide(timesheetId, ApprovalActionType.PushedBack, TimesheetStatus.Draft, request.Comment, true);
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var managerId = GetUserId();
        if (managerId is null)
        {
            return Unauthorized();
        }

        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthEnd = monthStart.AddMonths(1);

        var monthActions = await dbContext.ApprovalActions
            .Where(a => a.ManagerUserId == managerId.Value
                        && a.ActionedAtUtc >= monthStart
                        && a.ActionedAtUtc < monthEnd)
            .ToListAsync();

        var approvedThisMonth = monthActions.Count(a => a.Action == ApprovalActionType.Approved);
        var rejectedThisMonth = monthActions.Count(a => a.Action == ApprovalActionType.Rejected);

        // Avg response time (hours from submission to decision)
        double? avgResponseHours = null;
        var actionWithTs = await dbContext.ApprovalActions
            .Where(a => a.ManagerUserId == managerId.Value
                        && a.ActionedAtUtc >= monthStart
                        && a.ActionedAtUtc < monthEnd)
            .Join(dbContext.Timesheets, a => a.TimesheetId, t => t.Id,
                  (a, t) => new { a.ActionedAtUtc, t.SubmittedAtUtc })
            .Where(x => x.SubmittedAtUtc != null)
            .ToListAsync();

        if (actionWithTs.Count > 0)
            avgResponseHours = Math.Round(
                actionWithTs.Average(x => (x.ActionedAtUtc - x.SubmittedAtUtc!.Value).TotalHours), 1);

        return Ok(new
        {
            approvedThisMonth,
            rejectedThisMonth,
            avgResponseHours
        });
    }

    private async Task<IActionResult> Decide(Guid timesheetId, ApprovalActionType actionType, TimesheetStatus nextStatus, string? comment, bool requireComment)
    {
        var managerId = GetUserId();
        if (managerId is null)
        {
            return Unauthorized();
        }

        if (requireComment && string.IsNullOrWhiteSpace(comment))
        {
            return BadRequest(new { message = "Comment is required for this action." });
        }

        var role = User.FindFirstValue(ClaimTypes.Role) ?? "employee";
        var timesheet = await dbContext.Timesheets.Include(x => x.User).SingleOrDefaultAsync(x => x.Id == timesheetId);
        if (timesheet is null)
        {
            return NotFound();
        }

        if (timesheet.Status != TimesheetStatus.Submitted)
        {
            return Conflict(new { message = "Only submitted timesheets can be actioned." });
        }

        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) && timesheet.User.ManagerId != managerId.Value)
        {
            return Forbid();
        }

        timesheet.Status = nextStatus;
        timesheet.ManagerComment = comment?.Trim();
        timesheet.ApprovedByUserId = managerId.Value;
        if (nextStatus == TimesheetStatus.Approved)
        {
            timesheet.ApprovedAtUtc = DateTime.UtcNow;
            timesheet.RejectedAtUtc = null;
        }
        else if (nextStatus == TimesheetStatus.Rejected)
        {
            timesheet.RejectedAtUtc = DateTime.UtcNow;
            timesheet.ApprovedAtUtc = null;
        }
        else
        {
            timesheet.ApprovedAtUtc = null;
            timesheet.RejectedAtUtc = null;
        }

        dbContext.ApprovalActions.Add(new ApprovalAction
        {
            Id = Guid.NewGuid(),
            TimesheetId = timesheet.Id,
            ManagerUserId = managerId.Value,
            Action = actionType,
            Comment = comment?.Trim() ?? string.Empty,
            ActionedAtUtc = DateTime.UtcNow
        });

        await auditService.WriteAsync($"Timesheet{actionType}", "Timesheet", timesheetId.ToString(), $"Manager {managerId} set status to {nextStatus}", User);
        await dbContext.SaveChangesAsync();

        await notificationService.CreateAsync(timesheet.UserId, "Timesheet Status Updated",
            $"Your timesheet for {timesheet.WorkDate:yyyy-MM-dd} has been {actionType.ToString().ToLower()}.", NotificationType.StatusChange);

        return Ok(new { message = "Action completed." });
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(sub, out var userId) ? userId : null;
    }
}

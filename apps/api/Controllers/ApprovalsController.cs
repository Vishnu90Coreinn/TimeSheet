using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Approvals.Commands;
using TimeSheet.Application.Approvals.Queries;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "manager,admin")]
[Route("api/v1/approvals")]
public class ApprovalsController(ISender mediator, TimeSheetDbContext dbContext) : ControllerBase
{
    [HttpGet("pending-timesheets")]
    public async Task<IActionResult> GetPendingTimesheets(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetPendingTimesheetsQuery(), cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
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

    [HttpPost("timesheets/{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] TimesheetDecisionRequest request, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new ApproveTimesheetCommand(id, request.Comment), cancellationToken);
        return result.IsSuccess ? Ok(new { message = "Action completed." }) : Fail(result);
    }

    [HttpPost("timesheets/{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] TimesheetDecisionRequest request, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new RejectTimesheetCommand(id, request.Comment ?? string.Empty), cancellationToken);
        return result.IsSuccess ? Ok(new { message = "Action completed." }) : Fail(result);
    }

    [HttpPost("timesheets/{id:guid}/push-back")]
    public async Task<IActionResult> PushBack(Guid id, [FromBody] TimesheetDecisionRequest request, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new PushBackTimesheetCommand(id, request.Comment ?? string.Empty), cancellationToken);
        return result.IsSuccess ? Ok(new { message = "Action completed." }) : Fail(result);
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

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Forbid(),
        ResultStatus.Conflict => Conflict(new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(sub, out var userId) ? userId : null;
    }
}

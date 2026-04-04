using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Application.Approvals.Commands;
using TimeSheet.Application.Approvals.Queries;
using TimeSheet.Application.Common.Models;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "manager,admin")]
[Route("api/v1/approvals")]
public class ApprovalsController(ISender mediator) : ControllerBase
{
    [HttpGet("pending-timesheets")]
    public async Task<IActionResult> GetPendingTimesheets([FromQuery] PendingTimesheetsListQuery queryParams, CancellationToken ct)
    {
        var sortBy = (queryParams.SortBy ?? "workDate").Trim().ToLowerInvariant();
        var sortDir = (queryParams.SortDir ?? "desc").Trim().ToLowerInvariant();
        var desc = sortDir == "desc";
        var result = await mediator.Send(new GetPendingTimesheetsQuery(
            queryParams.Search,
            queryParams.HasMismatch,
            sortBy,
            desc,
            Math.Max(1, queryParams.Page),
            Math.Clamp(queryParams.PageSize, 1, 200)), ct);
        if (!result.IsSuccess) return Fail(result);

        var page = result.Value!;
        return Ok(new PagedResponse<PendingTimesheetItem>(
            page.Items,
            page.Page,
            page.PageSize,
            page.TotalCount,
            page.TotalPages,
            page.SortBy,
            page.SortDir));
    }

    [HttpGet("timesheets/{timesheetId:guid}")]
    public async Task<IActionResult> GetPendingTimesheetDetail(Guid timesheetId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetPendingTimesheetDetailQuery(timesheetId), ct);
        if (!result.IsSuccess) return Fail(result);

        var v = result.Value!;
        return Ok(new PendingTimesheetDetailResponse(
            v.TimesheetId,
            v.UserId,
            v.Username,
            v.DisplayName,
            v.WorkDate,
            v.Status,
            v.EnteredMinutes,
            v.MismatchReason,
            v.SubmittedAtUtc,
            v.Entries.Select(e => new PendingTimesheetDetailEntryResponse(
                e.Id,
                e.ProjectId,
                e.ProjectName,
                e.TaskCategoryId,
                e.TaskCategoryName,
                e.Minutes,
                e.Notes)).ToList()));
    }

    [HttpGet("history/{timesheetId:guid}")]
    [Authorize]
    public async Task<IActionResult> GetApprovalHistory(Guid timesheetId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetApprovalHistoryQuery(timesheetId), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [HttpPost("timesheets/{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] TimesheetDecisionRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new ApproveTimesheetCommand(id, request.Comment), ct);
        return result.IsSuccess ? Ok(new { message = "Action completed." }) : Fail(result);
    }

    [HttpPost("timesheets/{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] TimesheetDecisionRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new RejectTimesheetCommand(id, request.Comment ?? string.Empty), ct);
        return result.IsSuccess ? Ok(new { message = "Action completed." }) : Fail(result);
    }

    [HttpPost("timesheets/{id:guid}/push-back")]
    public async Task<IActionResult> PushBack(Guid id, [FromBody] TimesheetDecisionRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new PushBackTimesheetCommand(id, request.Comment ?? string.Empty), ct);
        return result.IsSuccess ? Ok(new { message = "Action completed." }) : Fail(result);
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(
        [FromQuery] ApprovalStatsPeriod period = ApprovalStatsPeriod.ThisMonth,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetApprovalStatsQuery(period, fromDate, toDate), ct);
        if (!result.IsSuccess) return Fail(result);
        var v = result.Value!;
        return Ok(new { v.ApprovedThisMonth, v.RejectedThisMonth, avgResponseHours = v.AvgResponseHours, period, fromDate, toDate });
    }

    [HttpGet("delegation")]
    public async Task<IActionResult> GetDelegation(CancellationToken ct)
    {
        var result = await mediator.Send(new GetDelegationQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [HttpPost("delegation")]
    public async Task<IActionResult> CreateDelegation([FromBody] CreateDelegationRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateDelegationCommand(
            request.ToUserId, request.FromDate, request.ToDate), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [HttpDelete("delegation/{id:guid}")]
    public async Task<IActionResult> RevokeDelegation(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new RevokeDelegationCommand(id), ct);
        if (!result.IsSuccess) return Fail(result);
        return NoContent();
    }

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Forbid(),
        ResultStatus.Conflict => Conflict(new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

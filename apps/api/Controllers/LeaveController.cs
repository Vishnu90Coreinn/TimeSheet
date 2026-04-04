using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Extensions;
using TimeSheet.Application.Leave.Commands;
using TimeSheet.Application.Leave.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/leave")]
public class LeaveController(ISender mediator) : ControllerBase
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
    public async Task<IActionResult> GetMyLeaveRequests([FromQuery] LeaveRequestsListQuery queryParams, CancellationToken ct)
    {
        var sortBy = (queryParams.SortBy ?? "leaveDate").Trim().ToLowerInvariant();
        var sortDir = (queryParams.SortDir ?? "desc").Trim().ToLowerInvariant();
        var desc = sortDir == "desc";
        var result = await mediator.Send(new GetMyLeaveRequestsQuery(
            queryParams.Search,
            sortBy,
            desc,
            Math.Max(1, queryParams.Page),
            Math.Clamp(queryParams.PageSize, 1, 200)), ct);
        if (!result.IsSuccess) return result.ToActionResult();

        var page = result.Value!;
        return Ok(ToPagedLeaveRequestResponse(page));
    }

    [HttpGet("requests/pending")]
    [Authorize(Roles = "manager,admin")]
    public async Task<IActionResult> GetPendingLeaveRequests([FromQuery] LeaveRequestsListQuery queryParams, CancellationToken ct)
    {
        var sortBy = (queryParams.SortBy ?? "leaveDate").Trim().ToLowerInvariant();
        var sortDir = (queryParams.SortDir ?? "desc").Trim().ToLowerInvariant();
        var desc = sortDir == "desc";
        var result = await mediator.Send(new GetPendingLeaveRequestsQuery(
            queryParams.Search,
            sortBy,
            desc,
            Math.Max(1, queryParams.Page),
            Math.Clamp(queryParams.PageSize, 1, 200)), ct);
        if (!result.IsSuccess) return result.ToActionResult();
        var page = result.Value!;
        return Ok(ToPagedLeaveRequestResponse(page));
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
    public async Task<IActionResult> GetPolicies([FromQuery] LeavePoliciesListQuery queryParams, CancellationToken ct)
    {
        var sortBy = (queryParams.SortBy ?? "name").Trim().ToLowerInvariant();
        var sortDir = (queryParams.SortDir ?? "asc").Trim().ToLowerInvariant();
        var desc = sortDir == "desc";
        var result = await mediator.Send(new GetLeavePoliciesPageQuery(
            queryParams.Search,
            queryParams.IsActive,
            sortBy,
            desc,
            Math.Max(1, queryParams.Page),
            Math.Clamp(queryParams.PageSize, 1, 200)), ct);
        if (!result.IsSuccess) return result.ToActionResult();

        var page = result.Value!;
        return Ok(ToPagedLeavePolicyResponse(page));
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
    public async Task<IActionResult> GetCalendar([FromQuery] int year, [FromQuery] int month, CancellationToken ct)
    {
        var result = await mediator.Send(new GetLeaveCalendarQuery(year, month), ct);
        return result.IsSuccess
            ? Ok(result.Value!.Select(x => new LeaveCalendarDay(x.Date, x.Type)).ToList())
            : result.ToActionResult();
    }

    // ── Team Leave Calendar ───────────────────────────────────────

    [HttpGet("team-calendar")]
    public async Task<IActionResult> GetTeamCalendar([FromQuery] int? year, [FromQuery] int? month, CancellationToken ct)
    {
        var result = await mediator.Send(new GetTeamLeaveCalendarQuery(year, month), ct);
        return result.IsSuccess
            ? Ok(result.Value!.Select(day => new TeamLeaveCalendarDay(
                day.Date,
                day.Entries.Select(entry => new TeamLeaveEntry(
                    entry.UserId,
                    entry.Username,
                    entry.DisplayName,
                    entry.LeaveTypeName,
                    entry.Status)).ToList())).ToList())
            : result.ToActionResult();
    }

    [HttpGet("conflicts")]
    public async Task<IActionResult> GetConflicts([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate, [FromQuery] Guid? userId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetLeaveConflictsQuery(fromDate, toDate, userId), ct);
        return result.IsSuccess
            ? Ok(new LeaveConflictResponse(result.Value!.ConflictingCount, result.Value.ConflictingUsernames))
            : result.ToActionResult();
    }

    // ── Team on Leave ─────────────────────────────────────────────

    [HttpGet("team-on-leave")]
    public async Task<IActionResult> GetTeamOnLeave(CancellationToken ct)
    {
        var result = await mediator.Send(new GetTeamOnLeaveQuery(), ct);
        return result.IsSuccess
            ? Ok(result.Value!.Select(x => new TeamLeaveEntryResponse(x.UserId, x.Username, x.FromDate, x.ToDate, x.LeaveTypeName, x.Status)).ToList())
            : result.ToActionResult();
    }

    private static PagedResponse<LeaveRequestResponse> ToPagedLeaveRequestResponse(
        Application.Common.Models.PagedResult<TimeSheet.Application.Common.Interfaces.LeaveRequestResult> page)
        => new(
            page.Items.Select(ToLeaveRequestResponse).ToList(),
            page.Page,
            page.PageSize,
            page.TotalCount,
            page.TotalPages,
            page.SortBy,
            page.SortDir);

    private static LeaveRequestResponse ToLeaveRequestResponse(TimeSheet.Application.Common.Interfaces.LeaveRequestResult request)
        => new(
            request.Id,
            request.UserId,
            request.Username,
            request.LeaveDate,
            request.LeaveTypeId,
            request.LeaveTypeName,
            request.IsHalfDay,
            request.Status,
            request.Comment,
            request.ReviewedByUserId,
            request.ReviewedByUsername,
            request.ReviewerComment,
            request.CreatedAtUtc,
            request.ReviewedAtUtc);

    private static PagedResponse<LeavePolicyResponse> ToPagedLeavePolicyResponse(
        Application.Common.Models.PagedResult<TimeSheet.Application.Common.Interfaces.LeavePolicyResult> page)
        => new(
            page.Items.Select(ToLeavePolicyResponse).ToList(),
            page.Page,
            page.PageSize,
            page.TotalCount,
            page.TotalPages,
            page.SortBy,
            page.SortDir);

    private static LeavePolicyResponse ToLeavePolicyResponse(TimeSheet.Application.Common.Interfaces.LeavePolicyResult policy)
        => new(
            policy.Id,
            policy.Name,
            policy.IsActive,
            policy.Allocations.Select(a => new LeavePolicyAllocationResponse(a.LeaveTypeId, a.LeaveTypeName, a.DaysPerYear)).ToList());

}

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Extensions;
using TimeSheet.Application.Manager.Commands;
using TimeSheet.Application.Manager.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "manager,admin")]
[Route("api/v1/manager")]
public class ManagerController(ISender mediator) : ControllerBase
{
    [HttpGet("team-status")]
    public async Task<ActionResult<PagedResponse<TeamMemberStatusResponse>>> GetTeamStatus([FromQuery] TeamStatusListQuery queryParams)
    {
        var effectiveDate = queryParams.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var sortBy = (queryParams.SortBy ?? "username").Trim().ToLowerInvariant();
        var sortDir = (queryParams.SortDir ?? "asc").Trim().ToLowerInvariant();
        var result = await mediator.Send(new GetTeamStatusPageQuery(
            effectiveDate,
            queryParams.Search,
            queryParams.Attendance,
            queryParams.TimesheetStatus,
            sortBy,
            sortDir == "desc",
            Math.Max(1, queryParams.Page),
            Math.Clamp(queryParams.PageSize, 1, 200)));

        if (!result.IsSuccess)
            return BadRequest(new { message = result.Error });

        var page = result.Value!;
        return Ok(new PagedResponse<TeamMemberStatusResponse>(
            page.Items.Select(ToResponse).ToList(),
            page.Page,
            page.PageSize,
            page.TotalCount,
            page.TotalPages,
            page.SortBy,
            page.SortDir));
    }

    [HttpPost("remind/{userId:guid}")]
    public async Task<IActionResult> RemindUser(Guid userId)
    {
        var result = await mediator.Send(new RemindUserCommand(userId));
        return result.IsSuccess ? NoContent() : result.ToActionResult();
    }

    private static TeamMemberStatusResponse ToResponse(TeamMemberStatusResult row)
        => new(
            row.UserId,
            row.Username,
            row.DisplayName,
            row.AvatarDataUrl,
            row.Attendance,
            row.CheckInAtUtc,
            row.CheckOutAtUtc,
            row.WeekLoggedMinutes,
            row.WeekExpectedMinutes,
            row.TodayTimesheetStatus,
            row.PendingApprovalCount);
}

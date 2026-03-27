using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Extensions;
using TimeSheet.Application.Overtime.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/overtime")]
public class OvertimeController(ISender mediator) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] Guid? userId, [FromQuery] DateOnly? weekStart, CancellationToken ct)
    {
        var requestedUserId = User.IsInRole("admin") || User.IsInRole("manager") ? userId : null;
        var query = new GetOvertimeSummaryQuery(requestedUserId, weekStart ?? DateOnly.FromDateTime(DateTime.UtcNow));
        var result = await mediator.Send(query, ct);
        if (!result.IsSuccess) return result.ToActionResult();

        var v = result.Value!;
        return Ok(new OvertimeSummaryResponse(v.UserId, v.WeekStart, v.WeekEnd, v.RegularHours, v.OvertimeHours, v.CompOffCredits));
    }

    [HttpGet("team-summary")]
    [Authorize(Roles = "manager,admin")]
    public async Task<IActionResult> GetTeamSummary([FromQuery] DateOnly? weekStart, CancellationToken ct)
    {
        var query = new GetTeamOvertimeSummaryQuery(weekStart ?? DateOnly.FromDateTime(DateTime.UtcNow));
        var result = await mediator.Send(query, ct);
        if (!result.IsSuccess) return result.ToActionResult();

        var v = result.Value!;
        return Ok(new TeamOvertimeSummaryResponse(v.WeekStart, v.WeekEnd, v.TotalOvertimeHours));
    }
}


using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Timers.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/timers")]
[Authorize]
public class TimersController(ISender mediator) : ControllerBase
{
    [HttpGet("active")]
    public async Task<IActionResult> GetActive(CancellationToken ct)
    {
        var result = await mediator.Send(new GetActiveTimerQuery(), ct);
        return result.IsSuccess ? Ok(ToResponse(result.Value!)) : Fail(result);
    }

    [HttpPost("start")]
    public async Task<IActionResult> Start([FromBody] StartTimerRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new StartTimerCommand(request.ProjectId, request.CategoryId, request.Note), ct);
        return result.IsSuccess ? Ok(ToResponse(result.Value!)) : Fail(result);
    }

    [HttpPost("stop")]
    public async Task<IActionResult> Stop(CancellationToken ct)
    {
        var result = await mediator.Send(new StopTimerCommand(), ct);
        return result.IsSuccess ? Ok(ToResponse(result.Value!)) : Fail(result);
    }

    [HttpPost("{id:guid}/convert")]
    public async Task<IActionResult> Convert(Guid id, [FromBody] ConvertTimerRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new ConvertTimerCommand(id, request.WorkDate), ct);
        return result.IsSuccess ? Ok(new { entryId = result.Value!.EntryId, timesheetId = result.Value.TimesheetId }) : Fail(result);
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] DateOnly? date, CancellationToken ct)
    {
        var result = await mediator.Send(new GetTimerHistoryQuery(date), ct);
        return result.IsSuccess ? Ok(result.Value!.Select(ToResponse).ToList()) : Fail(result);
    }

    private static TimerSessionResponse ToResponse(TimerSessionResult t) => new(
        t.Id,
        t.ProjectId,
        t.ProjectName,
        t.CategoryId,
        t.CategoryName,
        t.Note,
        t.StartedAtUtc,
        t.StoppedAtUtc,
        t.DurationMinutes,
        t.ConvertedToEntryId);

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Unauthorized(),
        ResultStatus.Conflict => Conflict(new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

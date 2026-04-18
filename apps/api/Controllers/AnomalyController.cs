using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Anomalies.Commands;
using TimeSheet.Application.Anomalies.Queries;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/admin/anomalies")]
public class AnomalyController(ISender mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAnomalies([FromQuery] string? severity, CancellationToken ct)
    {
        var result = await mediator.Send(new GetAnomaliesQuery(severity), ct);
        return result.IsSuccess
            ? Ok(result.Value!.Select(n => new AnomalyNotificationResponse(n.Id, n.Title, n.Message, n.Severity, n.CreatedAtUtc)).ToList())
            : Fail(result);
    }

    [HttpPost("{id:guid}/dismiss")]
    public async Task<IActionResult> Dismiss(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DismissAnomalyCommand(id), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Unauthorized(),
        ResultStatus.Conflict => Conflict(new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

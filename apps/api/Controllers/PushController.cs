using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Push.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/push")]
[Authorize]
public class PushController(ISender mediator) : ControllerBase
{
    [HttpGet("vapid-key")]
    public async Task<IActionResult> GetVapidKey(CancellationToken ct)
    {
        var result = await mediator.Send(new GetVapidKeyQuery(), ct);
        return result.IsSuccess ? Ok(new { publicKey = result.Value! }) : Fail(result);
    }

    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscribeRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new SubscribePushCommand(req.Endpoint, req.Keys.P256dh, req.Keys.Auth), ct);
        return result.IsSuccess ? Ok() : Fail(result);
    }

    [HttpPost("unsubscribe")]
    public async Task<IActionResult> Unsubscribe([FromBody] PushUnsubscribeRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UnsubscribePushCommand(req.Endpoint), ct);
        return result.IsSuccess ? Ok() : Fail(result);
    }

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Unauthorized(),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

public record PushSubscribeRequest(string Endpoint, PushSubscribeKeys Keys);
public record PushSubscribeKeys(string P256dh, string Auth);
public record PushUnsubscribeRequest(string Endpoint);

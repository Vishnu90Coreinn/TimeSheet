using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Privacy.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/privacy")]
public class PrivacyController(ISender mediator) : ControllerBase
{
    [HttpPost("export-request")]
    public async Task<IActionResult> RequestExport(CancellationToken ct)
    {
        var result = await mediator.Send(new RequestDataExportQuery(), ct);
        if (!result.IsSuccess) return Fail(result);
        return Ok(ToResponse(result.Value!));
    }

    [HttpGet("export-requests")]
    public async Task<IActionResult> GetExportRequests(CancellationToken ct)
    {
        var result = await mediator.Send(new GetDataExportRequestsQuery(), ct);
        if (!result.IsSuccess) return Fail(result);
        return Ok(result.Value!.Select(ToResponse).ToList());
    }

    [HttpPost("delete-account")]
    public async Task<IActionResult> DeleteAccount(CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteMyAccountCommand(), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    [HttpPost("consent")]
    public async Task<IActionResult> LogConsent([FromBody] ConsentRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new LogConsentCommand(request.ConsentType, request.Granted, HttpContext.Connection.RemoteIpAddress?.ToString()), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    private static ExportRequestResponse ToResponse(ExportRequestResult r)
        => new(r.Id, r.Status, r.RequestedAt, r.CompletedAt, r.DownloadUrl);

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Unauthorized(),
        ResultStatus.Conflict => Conflict(new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

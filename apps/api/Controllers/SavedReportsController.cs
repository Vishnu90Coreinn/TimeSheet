using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.SavedReports.Commands;
using TimeSheet.Application.SavedReports.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/reports/saved")]
public class SavedReportsController(ISender mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await mediator.Send(new GetSavedReportsQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SavedReportRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateSavedReportCommand(
            request.Name, request.ReportKey, request.FiltersJson,
            request.ScheduleType, request.ScheduleDayOfWeek,
            request.ScheduleHour, request.RecipientEmails), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] SavedReportRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateSavedReportCommand(
            id, request.Name, request.FiltersJson,
            request.ScheduleType, request.ScheduleDayOfWeek,
            request.ScheduleHour, request.RecipientEmails), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteSavedReportCommand(id), ct);
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

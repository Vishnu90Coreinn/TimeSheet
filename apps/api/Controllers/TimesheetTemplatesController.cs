using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.TimesheetTemplates.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/timesheets/templates")]
public class TimesheetTemplatesController(ISender mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await mediator.Send(new GetTimesheetTemplatesQuery(), ct);
        return result.IsSuccess
            ? Ok(result.Value!.Select(ToResponse).ToList())
            : Fail(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTemplateRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateTimesheetTemplateCommand(request.Name, request.Entries.Select(ToEntry).ToList()), ct);
        return result.IsSuccess ? Ok(ToResponse(result.Value!)) : Fail(result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTemplateRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateTimesheetTemplateCommand(id, request.Name, request.Entries.Select(ToEntry).ToList()), ct);
        return result.IsSuccess ? Ok(ToResponse(result.Value!)) : Fail(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteTimesheetTemplateCommand(id), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    [HttpPost("{id:guid}/apply")]
    public async Task<IActionResult> Apply(Guid id, [FromBody] ApplyTemplateRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new ApplyTimesheetTemplateCommand(id, request.WorkDate), ct);
        return result.IsSuccess
            ? Ok(new ApplyTemplateResult(result.Value!.EntriesCreated, result.Value.EntriesSkipped, result.Value.TimesheetId!.Value))
            : Fail(result);
    }

    private static TemplateEntryItemResult ToEntry(TemplateEntryData entry)
        => new(entry.ProjectId, entry.CategoryId, entry.Minutes, entry.Note);

    private static TemplateResponse ToResponse(TimesheetTemplateResult template)
        => new(template.Id, template.Name, template.CreatedAtUtc, template.Entries.Select(e => new TemplateEntryData(e.ProjectId, e.CategoryId, e.Minutes, e.Note)).ToList());

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Unauthorized(),
        ResultStatus.Conflict => Conflict(new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

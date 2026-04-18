using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.ReferenceData.Commands;
using TimeSheet.Application.ReferenceData.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/holidays")]
public class HolidaysController(ISender mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] HolidaysListQuery queryParams, CancellationToken ct)
    {
        var year = queryParams.Year ?? DateTime.UtcNow.Year;
        var sortBy = (queryParams.SortBy ?? "date").Trim().ToLowerInvariant();
        var sortDir = (queryParams.SortDir ?? "asc").Trim().ToLowerInvariant();
        var desc = sortDir == "desc";
        var result = await mediator.Send(new GetHolidaysPageQuery(
            year,
            queryParams.Search,
            queryParams.IsRecurring,
            sortBy,
            desc,
            Math.Max(1, queryParams.Page),
            Math.Clamp(queryParams.PageSize, 1, 200)), ct);
        if (!result.IsSuccess) return Fail(result);

        var page = result.Value!;
        return Ok(new PagedResponse<HolidayResult>(
            page.Items,
            page.Page,
            page.PageSize,
            page.TotalCount,
            page.TotalPages,
            page.SortBy,
            page.SortDir));
    }

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] UpsertHolidayRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateHolidayCommand(request.Name, request.Date, request.IsRecurring), ct);
        if (!result.IsSuccess) return Fail(result);
        return CreatedAtAction(nameof(GetAll), new { year = result.Value!.Date.Year }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertHolidayRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateHolidayCommand(id, request.Name, request.Date, request.IsRecurring), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteHolidayCommand(id), ct);
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

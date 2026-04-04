using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.ReferenceData.Commands;
using TimeSheet.Application.ReferenceData.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/task-categories")]
public class TaskCategoriesController(ISender mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await mediator.Send(new GetTaskCategoriesQuery(AdminAll: false), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [Authorize(Roles = "admin")]
    [HttpGet("admin")]
    public async Task<IActionResult> GetAllForAdmin([FromQuery] TaskCategoriesListQuery queryParams, CancellationToken ct)
    {
        var sortBy = (queryParams.SortBy ?? "name").Trim().ToLowerInvariant();
        var sortDir = (queryParams.SortDir ?? "asc").Trim().ToLowerInvariant();
        var desc = sortDir == "desc";
        var result = await mediator.Send(new GetTaskCategoriesPageQuery(
            queryParams.Search,
            queryParams.IsActive,
            queryParams.IsBillable,
            sortBy,
            desc,
            Math.Max(1, queryParams.Page),
            Math.Clamp(queryParams.PageSize, 1, 200)), ct);
        if (!result.IsSuccess) return Fail(result);

        var page = result.Value!;
        return Ok(new PagedResponse<TaskCategoryResult>(
            page.Items,
            page.Page,
            page.PageSize,
            page.TotalCount,
            page.TotalPages,
            page.SortBy,
            page.SortDir));
    }

    [Authorize(Roles = "admin")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertTaskCategoryRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateTaskCategoryCommand(request.Name, request.IsActive, request.IsBillable), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [Authorize(Roles = "admin")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertTaskCategoryRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateTaskCategoryCommand(id, request.Name, request.IsActive, request.IsBillable), ct);
        if (!result.IsSuccess) return Fail(result);
        return NoContent();
    }

    [Authorize(Roles = "admin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteTaskCategoryCommand(id), ct);
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

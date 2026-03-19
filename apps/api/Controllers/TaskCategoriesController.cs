using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Application.TaskCategories.Handlers;
using TimeSheet.Api.Application.TaskCategories.Models;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/task-categories")]
public class TaskCategoriesController(
    IGetTaskCategoriesHandler getTaskCategoriesHandler,
    ICreateTaskCategoryHandler createTaskCategoryHandler,
    IUpdateTaskCategoryHandler updateTaskCategoryHandler,
    IDeleteTaskCategoryHandler deleteTaskCategoryHandler) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> GetAll([FromQuery] TaskCategoryListQuery query, CancellationToken cancellationToken)
    {
        var effectiveQuery = new TaskCategoryListQuery
        {
            FetchAll = query.FetchAll,
            IncludeInactive = false,
            Name = query.Name,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize,
            SortBy = query.SortBy,
            SortDirection = query.SortDirection
        };

        var (data, error) = await getTaskCategoriesHandler.HandleAsync(effectiveQuery, cancellationToken);
        if (error is not null)
        {
            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        return Ok(data);
    }

    [Authorize(Roles = "admin")]
    [HttpGet("admin")]
    public async Task<ActionResult> GetAllForAdmin([FromQuery] TaskCategoryListQuery query, CancellationToken cancellationToken)
    {
        var effectiveQuery = new TaskCategoryListQuery
        {
            FetchAll = query.FetchAll,
            IncludeInactive = true,
            Name = query.Name,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize,
            SortBy = query.SortBy,
            SortDirection = query.SortDirection
        };

        var (data, error) = await getTaskCategoriesHandler.HandleAsync(effectiveQuery, cancellationToken);
        if (error is not null)
        {
            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        return Ok(data);
    }

    [Authorize(Roles = "admin")]
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] UpsertTaskCategoryRequest request, CancellationToken cancellationToken)
    {
        var (data, error) = await createTaskCategoryHandler.HandleAsync(request, cancellationToken);
        if (error is not null)
        {
            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        return Ok(data);
    }

    [Authorize(Roles = "admin")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertTaskCategoryRequest request, CancellationToken cancellationToken)
    {
        var error = await updateTaskCategoryHandler.HandleAsync(id, request, cancellationToken);
        if (error is not null)
        {
            if (error.Code == ErrorCodes.TaskCategoryNotFound)
            {
                return NotFound(new { message = error.Message, code = error.Code });
            }

            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        return NoContent();
    }

    [Authorize(Roles = "admin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var error = await deleteTaskCategoryHandler.HandleAsync(id, cancellationToken);
        if (error is not null)
        {
            if (error.Code == ErrorCodes.TaskCategoryNotFound)
            {
                return NotFound(new { message = error.Message, code = error.Code });
            }

            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        return NoContent();
    }
}

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Extensions;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Projects.Commands;
using TimeSheet.Application.Projects.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/projects")]
public class ProjectsController(ISender mediator) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResponse<ProjectResponse>>> GetAll([FromQuery] ProjectsListQuery queryParams)
    {
        var sortBy = (queryParams.SortBy ?? "name").Trim().ToLowerInvariant();
        var sortDir = (queryParams.SortDir ?? "asc").Trim().ToLowerInvariant();
        var pageSize = Math.Clamp(queryParams.PageSize, 1, 200);

        var result = await mediator.Send(new GetProjectsPageQuery(
            queryParams.Search,
            queryParams.Status,
            sortBy,
            sortDir == "desc",
            Math.Max(1, queryParams.Page),
            pageSize));

        if (!result.IsSuccess)
            return BadRequest(new { message = result.Error });

        var page = result.Value!;
        return Ok(new PagedResponse<ProjectResponse>(
            page.Items.Select(ToProjectResponse).ToList(),
            page.Page,
            page.PageSize,
            page.TotalCount,
            page.TotalPages,
            page.SortBy,
            page.SortDir));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetProjectByIdQuery(id));
        return result.IsSuccess ? Ok(ToProjectResponse(result.Value!)) : result.ToActionResult();
    }

    [Authorize(Roles = "admin")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertProjectRequest request)
    {
        var result = await mediator.Send(new CreateProjectCommand(request.Name, request.Code, request.IsActive, request.BudgetedHours));
        return result.IsSuccess ? Ok(ToProjectResponse(result.Value!)) : result.ToActionResult();
    }

    [Authorize(Roles = "admin")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertProjectRequest request)
    {
        var result = await mediator.Send(new UpdateProjectCommand(id, request.Name, request.Code, request.IsActive, request.BudgetedHours));
        return result.IsSuccess ? NoContent() : result.ToActionResult();
    }

    [Authorize(Roles = "admin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await mediator.Send(new DeleteProjectCommand(id));
        return result.IsSuccess ? NoContent() : result.ToActionResult();
    }

    [Authorize(Roles = "admin")]
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id)
    {
        var result = await mediator.Send(new ArchiveProjectCommand(id));
        return result.IsSuccess ? NoContent() : result.ToActionResult();
    }

    [Authorize(Roles = "admin")]
    [HttpPut("{id:guid}/members")]
    public async Task<IActionResult> SetMembers(Guid id, [FromBody] AssignProjectMembersRequest request)
    {
        var result = await mediator.Send(new SetProjectMembersCommand(id, request.UserIds.Distinct().ToList()));
        return result.IsSuccess ? NoContent() : result.ToActionResult();
    }

    [HttpGet("{id:guid}/members")]
    public async Task<IActionResult> GetMembers(Guid id)
    {
        var result = await mediator.Send(new GetProjectMembersQuery(id));
        return result.IsSuccess
            ? Ok(result.Value!.Select(x => new ProjectMemberResponse(x.UserId, x.Username, x.Email, x.IsActive)).ToList())
            : result.ToActionResult();
    }

    private static ProjectResponse ToProjectResponse(ProjectDetailResult project)
        => new(project.Id, project.Name, project.Code, project.IsActive, project.IsArchived, project.BudgetedHours);

    private static ProjectResponse ToProjectResponse(ProjectListItemResult project)
        => new(project.Id, project.Name, project.Code, project.IsActive, project.IsArchived, project.BudgetedHours);
}

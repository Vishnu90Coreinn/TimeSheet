using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/projects")]
public class ProjectsController(TimeSheetDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProjectResponse>>> GetAll()
    {
        var projects = await dbContext.Projects.AsNoTracking()
            .Where(p => !p.IsArchived)
            .OrderBy(p => p.Name)
            .Select(p => new ProjectResponse(p.Id, p.Name, p.Code, p.IsActive, p.IsArchived))
            .ToListAsync();

        return Ok(projects);
    }

    [Authorize(Roles = "admin")]
    [HttpPost]
    public async Task<ActionResult<ProjectResponse>> Create([FromBody] UpsertProjectRequest request)
    {
        if (await dbContext.Projects.AnyAsync(p => p.Code == request.Code))
        {
            return Conflict(new { message = "Project code already exists." });
        }

        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Code = request.Code.Trim(),
            IsActive = request.IsActive
        };

        dbContext.Projects.Add(project);
        await dbContext.SaveChangesAsync();

        return Ok(new ProjectResponse(project.Id, project.Name, project.Code, project.IsActive, project.IsArchived));
    }

    [Authorize(Roles = "admin")]
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id)
    {
        var project = await dbContext.Projects.SingleOrDefaultAsync(x => x.Id == id);
        if (project is null)
        {
            return NotFound();
        }

        project.IsArchived = true;
        project.IsActive = false;
        await dbContext.SaveChangesAsync();

        return NoContent();
    }
}

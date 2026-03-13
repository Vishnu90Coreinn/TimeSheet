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

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectResponse>> GetById(Guid id)
    {
        var project = await dbContext.Projects.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id);
        if (project is null)
        {
            return NotFound();
        }

        return Ok(new ProjectResponse(project.Id, project.Name, project.Code, project.IsActive, project.IsArchived));
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
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertProjectRequest request)
    {
        var project = await dbContext.Projects.SingleOrDefaultAsync(x => x.Id == id);
        if (project is null)
        {
            return NotFound();
        }

        var duplicateCode = await dbContext.Projects.AnyAsync(p => p.Id != id && p.Code == request.Code);
        if (duplicateCode)
        {
            return Conflict(new { message = "Project code already exists." });
        }

        project.Name = request.Name.Trim();
        project.Code = request.Code.Trim();
        project.IsActive = request.IsActive && !project.IsArchived;
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = "admin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var project = await dbContext.Projects.SingleOrDefaultAsync(x => x.Id == id);
        if (project is null)
        {
            return NotFound();
        }

        dbContext.Projects.Remove(project);
        await dbContext.SaveChangesAsync();
        return NoContent();
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

    [Authorize(Roles = "admin")]
    [HttpPut("{id:guid}/members")]
    public async Task<IActionResult> SetMembers(Guid id, [FromBody] AssignProjectMembersRequest request)
    {
        var project = await dbContext.Projects.Include(x => x.Members).SingleOrDefaultAsync(x => x.Id == id);
        if (project is null)
        {
            return NotFound();
        }

        var userIds = request.UserIds.Distinct().ToList();
        var existingUsers = await dbContext.Users.Where(u => userIds.Contains(u.Id)).Select(u => u.Id).ToListAsync();
        if (existingUsers.Count != userIds.Count)
        {
            return BadRequest(new { message = "One or more users do not exist." });
        }

        var targetUserIds = userIds.ToHashSet();
        var membershipsToRemove = project.Members
            .Where(member => !targetUserIds.Contains(member.UserId))
            .ToList();
        dbContext.ProjectMembers.RemoveRange(membershipsToRemove);

        var existingMemberUserIds = project.Members
            .Select(member => member.UserId)
            .ToHashSet();
        var membershipsToAdd = targetUserIds
            .Where(userId => !existingMemberUserIds.Contains(userId))
            .Select(userId => new ProjectMember { ProjectId = project.Id, UserId = userId })
            .ToList();

        if (membershipsToAdd.Count > 0)
        {
            dbContext.ProjectMembers.AddRange(membershipsToAdd);
        }

        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id:guid}/members")]
    public async Task<ActionResult<IEnumerable<ProjectMemberResponse>>> GetMembers(Guid id)
    {
        var projectExists = await dbContext.Projects.AnyAsync(p => p.Id == id);
        if (!projectExists)
        {
            return NotFound();
        }

        var members = await dbContext.ProjectMembers.AsNoTracking()
            .Where(pm => pm.ProjectId == id)
            .Include(pm => pm.User)
            .OrderBy(pm => pm.User.Username)
            .Select(pm => new ProjectMemberResponse(pm.UserId, pm.User.Username, pm.User.Email, pm.User.IsActive))
            .ToListAsync();

        return Ok(members);
    }
}

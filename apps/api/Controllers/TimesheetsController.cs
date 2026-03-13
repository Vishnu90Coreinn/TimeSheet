using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/timesheets")]
public class TimesheetsController(TimeSheetDbContext dbContext) : ControllerBase
{
    [HttpGet("entry-options")]
    public async Task<IActionResult> GetEntryOptions()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

        if (!Guid.TryParse(sub, out var userId))
        {
            return Unauthorized();
        }

        var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "employee";
        var projectsQuery = dbContext.Projects.AsNoTracking().Where(p => p.IsActive && !p.IsArchived);

        if (!string.Equals(userRole, "admin", StringComparison.OrdinalIgnoreCase))
        {
            projectsQuery = projectsQuery.Where(p => p.Members.Any(m => m.UserId == userId));
        }

        var projects = await projectsQuery
            .OrderBy(p => p.Name)
            .Select(p => new ProjectResponse(p.Id, p.Name, p.Code, p.IsActive, p.IsArchived))
            .ToListAsync();

        var categories = await dbContext.TaskCategories.AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new TaskCategoryResponse(c.Id, c.Name, c.IsActive))
            .ToListAsync();

        return Ok(new { projects, taskCategories = categories });
    }

    [HttpPost("submit")]
    public async Task<IActionResult> Submit([FromBody] SubmitTimesheetRequest request)
    {
        _ = request;

        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

        if (!Guid.TryParse(sub, out var userId))
        {
            return Unauthorized();
        }

        var isActive = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (bool?)u.IsActive)
            .SingleOrDefaultAsync();

        if (isActive is null)
        {
            return Unauthorized();
        }

        if (isActive is false)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Inactive users cannot submit timesheets." });
        }

        return StatusCode(
            StatusCodes.Status501NotImplemented,
            new { message = "Timesheet submission persistence is not implemented yet." });
    }
}

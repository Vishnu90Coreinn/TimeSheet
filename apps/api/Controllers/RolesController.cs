using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/roles")]
public class RolesController(TimeSheetDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RoleResponse>>> GetAll()
    {
        var roles = await dbContext.Roles.AsNoTracking()
            .OrderBy(r => r.Name)
            .Select(r => new RoleResponse(r.Id, r.Name))
            .ToListAsync();

        return Ok(roles);
    }

    [HttpPost]
    public async Task<ActionResult<RoleResponse>> Create([FromBody] AssignRoleRequest request)
    {
        if (await dbContext.Roles.AnyAsync(r => r.Name == request.RoleName))
        {
            return Conflict(new { message = "Role already exists." });
        }

        var role = new Role { Id = Guid.NewGuid(), Name = request.RoleName.Trim() };
        dbContext.Roles.Add(role);
        await dbContext.SaveChangesAsync();

        return Ok(new RoleResponse(role.Id, role.Name));
    }
}

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;
using TimeSheet.Api.Services;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/users")]
public class UsersController(TimeSheetDbContext dbContext, IPasswordHasher passwordHasher) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserResponse>>> GetAll([FromQuery] string? q)
    {
        var query = dbContext.Users.AsNoTracking()
            .Include(u => u.Department)
            .Include(u => u.WorkPolicy)
            .Include(u => u.Manager)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(u =>
                u.Username.Contains(term) ||
                u.Email.Contains(term) ||
                u.EmployeeId.Contains(term));
        }

        var users = await query
            .OrderBy(u => u.Username)
            .Select(u => new UserResponse(
                u.Id,
                u.Username,
                u.Email,
                u.EmployeeId,
                u.Role,
                u.IsActive,
                u.DepartmentId,
                u.Department != null ? u.Department.Name : null,
                u.WorkPolicyId,
                u.WorkPolicy != null ? u.WorkPolicy.Name : null,
                u.ManagerId,
                u.Manager != null ? u.Manager.Username : null))
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserResponse>> GetById(Guid id)
    {
        var user = await dbContext.Users.AsNoTracking()
            .Include(u => u.Department)
            .Include(u => u.WorkPolicy)
            .Include(u => u.Manager)
            .SingleOrDefaultAsync(u => u.Id == id);

        if (user is null)
        {
            return NotFound();
        }

        return Ok(new UserResponse(
            user.Id, user.Username, user.Email, user.EmployeeId, user.Role, user.IsActive,
            user.DepartmentId, user.Department?.Name, user.WorkPolicyId, user.WorkPolicy?.Name, user.ManagerId, user.Manager?.Username));
    }

    [HttpPost]
    public async Task<ActionResult<UserResponse>> Create([FromBody] UpsertUserRequest request)
    {
        if (await dbContext.Users.AnyAsync(u => u.Username == request.Username || u.Email == request.Email || u.EmployeeId == request.EmployeeId))
        {
            return Conflict(new { message = "Username, email, or employee id already exists." });
        }

        if (request.ManagerId.HasValue && !await dbContext.Users.AnyAsync(u => u.Id == request.ManagerId.Value))
        {
            return BadRequest(new { message = "Manager does not exist." });
        }

        var role = await dbContext.Roles.SingleOrDefaultAsync(r => r.Name == request.Role);
        if (role is null)
        {
            return BadRequest(new { message = "Invalid role." });
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username.Trim(),
            Email = request.Email.Trim(),
            EmployeeId = request.EmployeeId.Trim(),
            PasswordHash = passwordHasher.Hash(request.Password),
            Role = request.Role,
            IsActive = request.IsActive,
            DepartmentId = request.DepartmentId,
            WorkPolicyId = request.WorkPolicyId,
            ManagerId = request.ManagerId
        };

        dbContext.Users.Add(user);
        dbContext.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });

        await WriteAuditLogAsync("UserCreated", "User", user.Id.ToString(), $"Created user {user.Username}");
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = user.Id },
            new UserResponse(user.Id, user.Username, user.Email, user.EmployeeId, user.Role, user.IsActive,
                user.DepartmentId, null, user.WorkPolicyId, null, user.ManagerId, null));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request)
    {
        var user = await dbContext.Users.SingleOrDefaultAsync(u => u.Id == id);
        if (user is null)
        {
            return NotFound();
        }

        var duplicateExists = await dbContext.Users.AnyAsync(u => u.Id != id &&
            (u.Username == request.Username || u.Email == request.Email || u.EmployeeId == request.EmployeeId));
        if (duplicateExists)
        {
            return Conflict(new { message = "Username, email, or employee id already exists." });
        }

        if (request.ManagerId == id)
        {
            return BadRequest(new { message = "User cannot be their own manager." });
        }

        user.Username = request.Username.Trim();
        user.Email = request.Email.Trim();
        user.EmployeeId = request.EmployeeId.Trim();
        user.Role = request.Role;
        user.IsActive = request.IsActive;
        user.DepartmentId = request.DepartmentId;
        user.WorkPolicyId = request.WorkPolicyId;
        user.ManagerId = request.ManagerId;

        await WriteAuditLogAsync("UserUpdated", "User", user.Id.ToString(), $"Updated user {user.Username}");
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{id:guid}/manager")]
    public async Task<IActionResult> SetManager(Guid id, [FromBody] SetManagerRequest request)
    {
        if (id == request.ManagerId)
        {
            return BadRequest(new { message = "User cannot be their own manager." });
        }

        var user = await dbContext.Users.SingleOrDefaultAsync(u => u.Id == id);
        var manager = await dbContext.Users.SingleOrDefaultAsync(u => u.Id == request.ManagerId);

        if (user is null || manager is null)
        {
            return NotFound();
        }

        user.ManagerId = request.ManagerId;

        await WriteAuditLogAsync("ManagerAssigned", "User", user.Id.ToString(), $"Assigned manager {manager.Username} to {user.Username}");
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("{id:guid}/reportees")]
    public async Task<ActionResult<IEnumerable<UserResponse>>> GetReportees(Guid id)
    {
        var reportees = await dbContext.Users.AsNoTracking()
            .Where(u => u.ManagerId == id)
            .OrderBy(u => u.Username)
            .Select(u => new UserResponse(
                u.Id, u.Username, u.Email, u.EmployeeId, u.Role, u.IsActive,
                u.DepartmentId, null, u.WorkPolicyId, null, u.ManagerId, null))
            .ToListAsync();

        return Ok(reportees);
    }

    [HttpPost("{id:guid}/roles")]
    public async Task<IActionResult> AssignRole(Guid id, [FromBody] AssignRoleRequest request)
    {
        var user = await dbContext.Users.Include(u => u.UserRoles).SingleOrDefaultAsync(u => u.Id == id);
        var role = await dbContext.Roles.SingleOrDefaultAsync(r => r.Name == request.RoleName);

        if (user is null || role is null)
        {
            return NotFound();
        }

        if (await dbContext.UserRoles.AnyAsync(ur => ur.UserId == id && ur.RoleId == role.Id))
        {
            return Conflict(new { message = "Role already assigned." });
        }

        dbContext.UserRoles.Add(new UserRole { UserId = id, RoleId = role.Id });
        user.Role = request.RoleName;

        await WriteAuditLogAsync("RoleAssigned", "User", user.Id.ToString(), $"Assigned role {role.Name} to {user.Username}");
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    private async Task WriteAuditLogAsync(string action, string entityType, string entityId, string details)
    {
        var actorSub = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier || c.Type == System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
        Guid? actorUserId = Guid.TryParse(actorSub, out var parsedId) ? parsedId : null;

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorUserId = actorUserId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Details = details,
            CreatedAtUtc = DateTime.UtcNow
        });
    }
}

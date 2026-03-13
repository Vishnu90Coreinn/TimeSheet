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
    public async Task<ActionResult<IEnumerable<UserResponse>>> GetAll()
    {
        var users = await dbContext.Users.AsNoTracking()
            .OrderBy(u => u.Username)
            .Select(u => new UserResponse(u.Id, u.Username, u.Email, u.EmployeeId, u.Role, u.IsActive))
            .ToListAsync();

        return Ok(users);
    }

    [HttpPost]
    public async Task<ActionResult<UserResponse>> Create([FromBody] UpsertUserRequest request)
    {
        if (await dbContext.Users.AnyAsync(u => u.Username == request.Username || u.Email == request.Email || u.EmployeeId == request.EmployeeId))
        {
            return Conflict(new { message = "Username, email, or employee id already exists." });
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username.Trim(),
            Email = request.Email.Trim(),
            EmployeeId = request.EmployeeId.Trim(),
            PasswordHash = passwordHasher.Hash(request.Password),
            Role = request.Role,
            IsActive = request.IsActive
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new UserResponse(user.Id, user.Username, user.Email, user.EmployeeId, user.Role, user.IsActive));
    }
}

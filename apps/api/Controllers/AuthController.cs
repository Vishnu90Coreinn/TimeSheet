using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Services;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController(TimeSheetDbContext dbContext, IPasswordHasher passwordHasher, ITokenService tokenService) : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var identifier = request.Identifier?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Username/email and password are required." });
        }

        var user = await dbContext.Users.SingleOrDefaultAsync(u =>
            u.Username == identifier || u.Email == identifier);

        if (user is null || !user.IsActive || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid credentials." });
        }

        var token = tokenService.CreateToken(user);
        return Ok(new LoginResponse(token, user.Id, user.Username, user.Email, user.Role));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var sub = User.Claims.FirstOrDefault(c => c.Type == System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
        if (!Guid.TryParse(sub, out var userId))
        {
            return Unauthorized();
        }

        var user = await dbContext.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == userId);
        if (user is null)
        {
            return NotFound();
        }

        return Ok(new UserResponse(user.Id, user.Username, user.Email, user.EmployeeId, user.Role, user.IsActive));
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;
using TimeSheet.Api.Services;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController(TimeSheetDbContext dbContext, IPasswordHasher passwordHasher, ITokenService tokenService, IConfiguration configuration) : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var identifier = request.Identifier?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Username/email and password are required." });
        }

        var user = await dbContext.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .SingleOrDefaultAsync(u => u.Username == identifier || u.Email == identifier);

        if (user is null || !user.IsActive || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid credentials." });
        }

        var roleName = user.UserRoles.Select(ur => ur.Role.Name).FirstOrDefault() ?? user.Role;
        var accessToken = tokenService.CreateAccessToken(user.Id, user.Username, roleName);
        var refreshToken = tokenService.CreateRefreshToken();

        var refreshTokenExpiryDays = int.TryParse(configuration["Jwt:RefreshTokenExpiryDays"], out var configuredDays)
            ? configuredDays
            : 14;

        dbContext.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = refreshToken,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(refreshTokenExpiryDays)
        });

        await dbContext.SaveChangesAsync();

        return Ok(new LoginResponse(accessToken, refreshToken, user.Id, user.Username, user.Email, roleName));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<LoginResponse>> Refresh([FromBody] RefreshTokenRequest request)
    {
        var savedToken = await dbContext.RefreshTokens
            .Include(rt => rt.User)
            .ThenInclude(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .SingleOrDefaultAsync(rt => rt.Token == request.RefreshToken);

        if (savedToken is null || savedToken.IsRevoked || savedToken.ExpiresAtUtc <= DateTime.UtcNow || !savedToken.User.IsActive)
        {
            return Unauthorized(new { message = "Invalid refresh token." });
        }

        savedToken.IsRevoked = true;

        var roleName = savedToken.User.UserRoles.Select(ur => ur.Role.Name).FirstOrDefault() ?? savedToken.User.Role;
        var accessToken = tokenService.CreateAccessToken(savedToken.UserId, savedToken.User.Username, roleName);
        var newRefreshToken = tokenService.CreateRefreshToken();

        var refreshTokenExpiryDays = int.TryParse(configuration["Jwt:RefreshTokenExpiryDays"], out var configuredDays)
            ? configuredDays
            : 14;

        dbContext.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = savedToken.UserId,
            Token = newRefreshToken,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(refreshTokenExpiryDays)
        });

        await dbContext.SaveChangesAsync();

        return Ok(new LoginResponse(accessToken, newRefreshToken, savedToken.UserId, savedToken.User.Username, savedToken.User.Email, roleName));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest request)
    {
        var savedToken = await dbContext.RefreshTokens.SingleOrDefaultAsync(rt => rt.Token == request.RefreshToken);
        if (savedToken is not null)
        {
            savedToken.IsRevoked = true;
            await dbContext.SaveChangesAsync();
        }

        return NoContent();
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

        var user = await dbContext.Users
            .AsNoTracking()
            .Include(u => u.Department)
            .Include(u => u.WorkPolicy)
            .Include(u => u.Manager)
            .SingleOrDefaultAsync(u => u.Id == userId);

        if (user is null)
        {
            return NotFound();
        }

        return Ok(new UserResponse(
            user.Id,
            user.Username,
            user.Email,
            user.EmployeeId,
            user.Role,
            user.IsActive,
            user.DepartmentId,
            user.Department?.Name,
            user.WorkPolicyId,
            user.WorkPolicy?.Name,
            user.ManagerId,
            user.Manager?.Username));
    }
}

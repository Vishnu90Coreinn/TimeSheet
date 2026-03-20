using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Auth.Commands;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController(ISender mediator, TimeSheetDbContext dbContext) : ControllerBase
{
    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new LoginCommand(request.Identifier, request.Password), ct);
        if (!result.IsSuccess)
            return Fail(result);

        var v = result.Value!;
        return Ok(new LoginResponse(v.AccessToken, v.RefreshToken, v.UserId, v.Username, v.Email, v.Role));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new RefreshTokenCommand(request.RefreshToken), ct);
        if (!result.IsSuccess)
            return Fail(result);

        var v = result.Value!;
        return Ok(new LoginResponse(v.AccessToken, v.RefreshToken, v.UserId, v.Username, v.Email, v.Role));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new LogoutCommand(request.RefreshToken), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
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
            .Include(u => u.LeavePolicy)
            .Include(u => u.Manager)
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .SingleOrDefaultAsync(u => u.Id == userId);

        if (user is null)
        {
            return NotFound();
        }

        var roleName = user.UserRoles.Select(ur => ur.Role.Name).FirstOrDefault() ?? "employee";

        return Ok(new UserResponse(
            user.Id,
            user.Username,
            user.Email,
            user.EmployeeId,
            roleName,
            user.IsActive,
            user.DepartmentId,
            user.Department?.Name,
            user.WorkPolicyId,
            user.WorkPolicy?.Name,
            user.LeavePolicyId,
            user.LeavePolicy?.Name,
            user.ManagerId,
            user.Manager?.Username));
    }

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => StatusCode(403, new { message = result.Error }),
        _ => Problem(result.Error, statusCode: StatusCodes.Status400BadRequest)
    };

    private IActionResult Fail<T>(Result<T> result) => Fail((Result)result);
}

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Auth.Commands;
using TimeSheet.Application.Auth.Queries;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController(ISender mediator) : ControllerBase
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
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var result = await mediator.Send(new GetCurrentUserQuery(), ct);
        if (!result.IsSuccess) return Fail(result);
        var u = result.Value!;
        return Ok(new UserResponse(u.Id, u.Username, u.Email, u.EmployeeId, u.Role, u.IsActive,
            u.DepartmentId, u.DepartmentName, u.WorkPolicyId, u.WorkPolicyName,
            u.LeavePolicyId, u.LeavePolicyName, u.ManagerId, u.ManagerUsername));
    }

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => StatusCode(403, new { message = result.Error }),
        _ => Problem(result.Error, statusCode: StatusCodes.Status400BadRequest)
    };

    private IActionResult Fail<T>(Result<T> result) => Fail((Result)result);
}

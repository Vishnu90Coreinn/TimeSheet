using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.PasswordPolicy.Commands;
using TimeSheet.Application.PasswordPolicy.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/password-policy")]
public class PasswordPolicyController(ISender mediator) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var result = await mediator.Send(new GetPasswordPolicyQuery(), ct);
        if (!result.IsSuccess) return Fail(result);
        var v = result.Value!;
        return Ok(new PasswordPolicyResponse(v.MinLength, v.RequireUppercase, v.RequireLowercase, v.RequireNumber, v.RequireSpecialChar, v.MaxAgeDays));
    }

    [HttpPut]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Update([FromBody] UpdatePasswordPolicyRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdatePasswordPolicyCommand(
            request.MinLength,
            request.RequireUppercase,
            request.RequireLowercase,
            request.RequireNumber,
            request.RequireSpecialChar,
            request.MaxAgeDays), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => StatusCode(403, new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };

    private IActionResult Fail<T>(Result<T> result) => Fail((Result)result);
}

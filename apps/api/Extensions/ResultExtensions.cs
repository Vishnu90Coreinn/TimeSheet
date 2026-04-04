using Microsoft.AspNetCore.Mvc;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Api.Extensions;

public static class ResultExtensions
{
    public static IActionResult ToActionResult(this Result result) => result.Status switch
    {
        ResultStatus.Success    => new OkResult(),
        ResultStatus.NotFound   => new NotFoundObjectResult(new { error = result.Error }),
        ResultStatus.Forbidden  => new ObjectResult(new { error = result.Error }) { StatusCode = 403 },
        ResultStatus.Conflict   => new ConflictObjectResult(new { error = result.Error }),
        ResultStatus.Validation => new UnprocessableEntityObjectResult(new { error = result.Error }),
        _                       => new BadRequestObjectResult(new { error = result.Error })
    };

    public static IActionResult ToActionResult<T>(this Result<T> result) => result.Status switch
    {
        ResultStatus.Success    => new OkObjectResult(result.Value),
        ResultStatus.NotFound   => new NotFoundObjectResult(new { error = result.Error }),
        ResultStatus.Forbidden  => new ObjectResult(new { error = result.Error }) { StatusCode = 403 },
        ResultStatus.Conflict   => new ConflictObjectResult(new { error = result.Error }),
        ResultStatus.Validation => new UnprocessableEntityObjectResult(new { error = result.Error }),
        _                       => new BadRequestObjectResult(new { error = result.Error })
    };
}

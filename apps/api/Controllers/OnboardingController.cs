using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Onboarding.Commands;
using TimeSheet.Application.Onboarding.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/onboarding")]
public class OnboardingController(ISender mediator) : ControllerBase
{
    [HttpGet("checklist")]
    public async Task<IActionResult> Checklist(CancellationToken ct)
    {
        var result = await mediator.Send(new GetOnboardingChecklistQuery(), ct);
        if (!result.IsSuccess)
            return Fail(result);

        var checklist = result.Value!;
        return Ok(new OnboardingChecklistResponse(
            checklist.HasSubmittedTimesheet,
            checklist.HasAppliedLeave,
            checklist.HasVisitedLeaveWorkflow,
            checklist.HasSetTimezone,
            checklist.HasSetNotificationPrefs,
            checklist.AdminHasProject,
            checklist.AdminHasLeavePolicy,
            checklist.AdminHasHoliday,
            checklist.AdminHasUser));
    }

    [HttpPost("leave-workflow")]
    public async Task<IActionResult> LeaveWorkflow(CancellationToken ct)
    {
        var result = await mediator.Send(new MarkLeaveWorkflowVisitedCommand(), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    [HttpPost("complete")]
    public async Task<IActionResult> Complete(CancellationToken ct)
    {
        var result = await mediator.Send(new CompleteOnboardingCommand(), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => StatusCode(403, new { message = result.Error }),
        _ => Problem(result.Error, statusCode: StatusCodes.Status400BadRequest)
    };

    private IActionResult Fail<T>(Result<T> result) => Fail((Result)result);
}

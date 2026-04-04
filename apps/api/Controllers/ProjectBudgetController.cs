using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.ProjectBudget.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "manager,admin")]
[Route("api/v1/projects")]
public class ProjectBudgetController(ISender mediator) : ControllerBase
{
    [HttpGet("budget-health")]
    public async Task<IActionResult> GetBudgetHealth(CancellationToken ct)
    {
        var result = await mediator.Send(new GetProjectBudgetHealthQuery(), ct);
        if (!result.IsSuccess) return Fail(result);
        return Ok(result.Value!.Select(x => new ProjectBudgetHealthItem(x.Id, x.Name, x.Code, x.BudgetedHours, x.LoggedHours, x.PctUsed, x.Status)).ToList());
    }

    [Authorize]
    [HttpGet("{id:guid}/budget-summary")]
    public async Task<IActionResult> GetBudgetSummary(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetProjectBudgetSummaryQuery(id), ct);
        if (!result.IsSuccess) return Fail(result);
        return Ok(new ProjectBudgetSummaryResponse(
                result.Value!.Id,
                result.Value.Name,
                result.Value.BudgetedHours,
                result.Value.LoggedHours,
                result.Value.RemainingHours,
                result.Value.BurnRateHoursPerWeek,
                result.Value.ProjectedWeeksRemaining,
                result.Value.WeeklyBreakdown.Select(x => new WeeklyBurnEntry(x.WeekStart, x.Hours)).ToList()));
    }

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Unauthorized(),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

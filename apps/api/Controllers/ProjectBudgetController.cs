using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Application.ProjectBudget.Handlers;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "manager,admin")]
[Route("api/v1/projects")]
public class ProjectBudgetController(
    IGetProjectBudgetHealthHandler getProjectBudgetHealthHandler,
    IGetProjectBudgetSummaryHandler getProjectBudgetSummaryHandler) : ControllerBase
{
    [HttpGet("budget-health")]
    public async Task<ActionResult> GetBudgetHealth(CancellationToken cancellationToken)
    {
        var (data, error) = await getProjectBudgetHealthHandler.HandleAsync(cancellationToken);
        if (error is not null)
        {
            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        return Ok(data);
    }

    [Authorize]
    [HttpGet("{id:guid}/budget-summary")]
    public async Task<ActionResult> GetBudgetSummary(Guid id, CancellationToken cancellationToken)
    {
        var (data, error) = await getProjectBudgetSummaryHandler.HandleAsync(id, cancellationToken);
        if (error is not null)
        {
            if (error.Code == ErrorCodes.ProjectNotFound)
            {
                return NotFound(new { message = error.Message, code = error.Code });
            }

            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        return Ok(data);
    }
}

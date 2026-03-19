using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Application.Anomaly.Handlers;
using TimeSheet.Api.Application.Anomaly.Models;
using TimeSheet.Api.Application.Common.Constants;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/admin/anomalies")]
public class AnomalyController(IGetAnomaliesHandler getAnomaliesHandler, IDismissAnomalyHandler dismissAnomalyHandler) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAnomalies([FromQuery] AnomalyListQuery query, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var (data, error) = await getAnomaliesHandler.HandleAsync(userId.Value, query, cancellationToken);
        if (error is not null)
        {
            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        return Ok(data);
    }

    [HttpPost("{id:guid}/dismiss")]
    public async Task<IActionResult> Dismiss(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var error = await dismissAnomalyHandler.HandleAsync(userId.Value, id, cancellationToken);
        if (error is not null)
        {
            if (error.Code == ErrorCodes.AnomalyNotFound)
            {
                return NotFound(new { message = error.Message, code = error.Code });
            }

            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        return NoContent();
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}

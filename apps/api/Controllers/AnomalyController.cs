using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/admin/anomalies")]
public class AnomalyController(TimeSheetDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// GET /api/v1/admin/anomalies?severity=warning|critical
    /// Returns unread Anomaly-type notifications for the calling admin user.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAnomalies([FromQuery] string? severity)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var query = dbContext.Notifications
            .Where(n => n.UserId == userId.Value
                        && n.Type == NotificationType.Anomaly
                        && !n.IsRead)
            .OrderByDescending(n => n.CreatedAtUtc);

        var notifications = await query.ToListAsync();

        var mapped = notifications
            .Select(n => new AnomalyNotificationResponse(
                n.Id,
                n.Title,
                n.Message,
                InferSeverity(n.Title),
                DateTime.SpecifyKind(n.CreatedAtUtc, DateTimeKind.Utc).ToString("O")))
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(severity))
            mapped = mapped.Where(r => r.Severity.Equals(severity, StringComparison.OrdinalIgnoreCase));

        return Ok(mapped.ToList());
    }

    /// <summary>
    /// POST /api/v1/admin/anomalies/{id}/dismiss
    /// Marks the anomaly notification as read (dismissed).
    /// </summary>
    [HttpPost("{id:guid}/dismiss")]
    public async Task<IActionResult> Dismiss(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var notification = await dbContext.Notifications
            .FirstOrDefaultAsync(n => n.Id == id
                                      && n.UserId == userId.Value
                                      && n.Type == NotificationType.Anomaly);

        if (notification is null) return NotFound();

        notification.IsRead = true;
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    private static string InferSeverity(string title)
    {
        if (title.Contains("Critical", StringComparison.OrdinalIgnoreCase)
            || title.Equals("Compliance Dropped", StringComparison.OrdinalIgnoreCase))
            return "critical";
        return "warning";
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}

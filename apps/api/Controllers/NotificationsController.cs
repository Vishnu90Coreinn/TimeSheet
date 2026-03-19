using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Services;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/notifications")]
public class NotificationsController(INotificationService notificationService, ILogger<NotificationsController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetUnread()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var notifications = await notificationService.GetUnreadAsync(userId.Value);
        var response = notifications.Select(n => new NotificationResponse(n.Id, n.Title, n.Message, n.Type.ToString(), n.IsRead, n.CreatedAtUtc)).ToList();
        return Ok(response);
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        await notificationService.MarkReadAsync(id, userId.Value);
        logger.LogInformation("User {UserId} marked notification {NotificationId} as read", userId, id);
        return NoContent();
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        await notificationService.MarkAllReadAsync(userId.Value);
        logger.LogInformation("User {UserId} marked all notifications as read", userId);
        return NoContent();
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Extensions;
using TimeSheet.Application.Notifications.Commands;
using TimeSheet.Application.Notifications.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/notifications")]
public class NotificationsController(ISender mediator, ILogger<NotificationsController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetNotificationsQuery(page, pageSize), ct);
        if (!result.IsSuccess) return result.ToActionResult();

        var v = result.Value!;
        return Ok(new NotificationPageResponse(
            v.Items.Select(item => new NotificationResponse(
                item.Id,
                item.Title,
                item.Message,
                item.Type,
                item.IsRead,
                item.CreatedAtUtc,
                item.GroupKey,
                item.ActionUrl)).ToList(),
            v.TotalUnread,
            v.HasMore));
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new MarkNotificationReadCommand(id), ct);
        if (!result.IsSuccess) return result.ToActionResult();

        logger.LogInformation("Marked notification {NotificationId} as read", id);
        return NoContent();
    }

    [HttpPost("mark-all-read")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        var result = await mediator.Send(new MarkAllNotificationsReadCommand(), ct);
        if (!result.IsSuccess) return result.ToActionResult();

        logger.LogInformation("Marked all notifications as read");
        return NoContent();
    }

    [HttpPut("read-all")]
    public Task<IActionResult> MarkAllReadLegacy(CancellationToken ct) => MarkAllRead(ct);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteNotificationCommand(id), ct);
        if (!result.IsSuccess) return result.ToActionResult();

        logger.LogInformation("Deleted notification {NotificationId}", id);
        return NoContent();
    }

    [HttpDelete]
    public async Task<IActionResult> Clear(CancellationToken ct)
    {
        var result = await mediator.Send(new ClearNotificationsCommand(), ct);
        if (!result.IsSuccess) return result.ToActionResult();

        logger.LogInformation("Cleared notifications for current user");
        return NoContent();
    }

}

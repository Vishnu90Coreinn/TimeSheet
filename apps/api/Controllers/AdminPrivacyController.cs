using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.AdminPrivacy.Queries;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/admin")]
public class AdminPrivacyController(ISender mediator) : ControllerBase
{
    [HttpGet("retention-policy")]
    public async Task<ActionResult<RetentionPolicyResponse>> GetRetentionPolicy(CancellationToken ct)
    {
        var result = await mediator.Send(new GetRetentionPolicyQuery(), ct);
        return result.IsSuccess
            ? Ok(new RetentionPolicyResponse(result.Value!.Policies.Select(x => new RetentionPolicyItem(x.DataType, x.RetentionDays)).ToList()))
            : Fail(result);
    }

    [HttpPut("retention-policy")]
    public async Task<ActionResult<RetentionPolicyResponse>> UpdateRetentionPolicy([FromBody] IEnumerable<RetentionPolicyItem> items, CancellationToken ct)
    {
        var result = await mediator.Send(
            new UpdateRetentionPolicyCommand(items.Select(i => new RetentionPolicyItemResult(i.DataType, i.RetentionDays)).ToList()),
            ct);

        return result.IsSuccess
            ? Ok(new RetentionPolicyResponse(result.Value!.Policies.Select(x => new RetentionPolicyItem(x.DataType, x.RetentionDays)).ToList()))
            : Fail(result);
    }

    [HttpGet("audit-logs")]
    public async Task<ActionResult<AuditLogPageResponse>> GetAuditLogs(
        [FromQuery] string? search,
        [FromQuery] Guid? actorId,
        [FromQuery] string? action,
        [FromQuery] string? entityType,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] string? sortOrder,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(
            new GetAuditLogsQuery(search, actorId, action, entityType, fromDate, toDate, sortOrder, Math.Max(1, page), Math.Clamp(pageSize, 1, 200)),
            ct);

        return result.IsSuccess
            ? Ok(new AuditLogPageResponse(result.Value!.Items.Select(ToAuditLogEntry).ToList(), result.Value.TotalCount, result.Value.Page, result.Value.PageSize))
            : Fail(result);
    }

    [HttpGet("audit-logs/{id:guid}/changes")]
    public async Task<ActionResult<IReadOnlyList<AuditChangeDto>>> GetAuditChanges(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetAuditChangesQuery(id), ct);
        return result.IsSuccess
            ? Ok(result.Value!.Select(c => new AuditChangeDto(c.FieldName, c.OldValue, c.NewValue, c.ValueType)).ToList())
            : Fail(result);
    }

    [HttpGet("audit-logs/entities/{entityType}/{entityId}")]
    public async Task<ActionResult<IReadOnlyList<AuditLogEntry>>> GetEntityHistory(
        string entityType,
        string entityId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(
            new GetEntityAuditHistoryQuery(entityType, entityId, Math.Max(1, page), Math.Clamp(pageSize, 1, 200)),
            ct);

        return result.IsSuccess
            ? Ok(result.Value!.Select(ToAuditLogEntry).ToList())
            : Fail(result);
    }

    [HttpGet("audit-logs/stats")]
    public async Task<ActionResult<AuditLogStats>> GetAuditLogStats(CancellationToken ct)
    {
        var result = await mediator.Send(new GetAuditLogStatsQuery(), ct);
        return result.IsSuccess
            ? Ok(new AuditLogStats(result.Value!.TotalCount, result.Value.LastEventAt, result.Value.RetentionDays))
            : Fail(result);
    }

    [HttpGet("audit-logs/actors")]
    public async Task<ActionResult<IReadOnlyList<AuditActorSummary>>> GetAuditActors(CancellationToken ct)
    {
        var result = await mediator.Send(new GetAuditActorsQuery(), ct);
        return result.IsSuccess
            ? Ok(result.Value!.Select(a => new AuditActorSummary(a.UserId, a.DisplayName, a.Username)).ToList())
            : Fail(result);
    }

    [HttpGet("audit-logs/export")]
    public async Task<IActionResult> ExportAuditLogs(
        [FromQuery] string? search,
        [FromQuery] Guid? actorId,
        [FromQuery] string? action,
        [FromQuery] string? entityType,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new ExportAuditLogsQuery(search, actorId, action, entityType, fromDate, toDate), ct);
        return result.IsSuccess
            ? File(result.Value!.Content, result.Value.ContentType, result.Value.FileName)
            : Fail(result);
    }

    private static AuditLogEntry ToAuditLogEntry(AuditLogEntryResult entry)
        => new(entry.Id, entry.ActorUserId, entry.ActorName, entry.ActorUsername, entry.Action, entry.EntityType, entry.EntityId, entry.Details, entry.CreatedAtUtc, entry.HasFieldChanges);

    private ActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Forbid(),
        ResultStatus.Conflict => Conflict(new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

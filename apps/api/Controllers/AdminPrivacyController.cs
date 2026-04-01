using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/admin")]
public class AdminPrivacyController(IAdminPrivacyRepository adminPrivacyRepository) : ControllerBase
{
    private static readonly (string DataType, int DefaultDays)[] Defaults =
    [
        ("timesheets", 2555),
        ("auditlogs", 365),
        ("notifications", 90),
        ("sessions", 180)
    ];

    [HttpGet("retention-policy")]
    public async Task<ActionResult<RetentionPolicyResponse>> GetRetentionPolicy()
    {
        var stored = await adminPrivacyRepository.GetRetentionPoliciesAsync();
        var result = Defaults.Select(d =>
        {
            var row = stored.FirstOrDefault(s => s.DataType == d.DataType);
            return new RetentionPolicyItem(d.DataType, row?.RetentionDays ?? d.DefaultDays);
        }).ToList();

        return Ok(new RetentionPolicyResponse(result));
    }

    [HttpPut("retention-policy")]
    public async Task<ActionResult<RetentionPolicyResponse>> UpdateRetentionPolicy([FromBody] IEnumerable<RetentionPolicyItem> items)
    {
        await adminPrivacyRepository.UpsertRetentionPoliciesAsync(
            items.Select(i => new RetentionPolicyReadModel(i.DataType, i.RetentionDays)));

        return await GetRetentionPolicy();
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
        [FromQuery] int pageSize = 25)
    {
        var result = await adminPrivacyRepository.GetAuditLogsAsync(new AuditLogFilterReadModel(
            search, actorId, action, entityType, fromDate, toDate, sortOrder, page, pageSize));

        var items = result.Items.Select(a => new AuditLogEntry(
            a.Id,
            a.ActorUserId,
            a.ActorName,
            a.ActorUsername,
            a.Action,
            a.EntityType,
            a.EntityId,
            a.Details,
            a.CreatedAtUtc,
            a.HasFieldChanges)).ToList();

        return Ok(new AuditLogPageResponse(items, result.TotalCount, result.Page, result.PageSize));
    }

    [HttpGet("audit-logs/{id:guid}/changes")]
    public async Task<ActionResult<IReadOnlyList<AuditChangeDto>>> GetAuditChanges(Guid id)
    {
        var items = await adminPrivacyRepository.GetAuditChangesAsync(id);
        if (items is null)
        {
            return NotFound();
        }

        return Ok(items.Select(c => new AuditChangeDto(c.FieldName, c.OldValue, c.NewValue, c.ValueType)).ToList());
    }

    [HttpGet("audit-logs/entities/{entityType}/{entityId}")]
    public async Task<ActionResult<IReadOnlyList<AuditLogEntry>>> GetEntityHistory(
        string entityType,
        string entityId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var items = await adminPrivacyRepository.GetEntityHistoryAsync(entityType, entityId, page, pageSize);

        return Ok(items.Select(a => new AuditLogEntry(
            a.Id,
            a.ActorUserId,
            a.ActorName,
            a.ActorUsername,
            a.Action,
            a.EntityType,
            a.EntityId,
            a.Details,
            a.CreatedAtUtc,
            a.HasFieldChanges)).ToList());
    }

    [HttpGet("audit-logs/stats")]
    public async Task<ActionResult<AuditLogStats>> GetAuditLogStats()
    {
        var stats = await adminPrivacyRepository.GetAuditStatsAsync();
        return Ok(new AuditLogStats(stats.TotalCount, stats.LastEventAt, stats.RetentionDays));
    }

    [HttpGet("audit-logs/actors")]
    public async Task<ActionResult<IReadOnlyList<AuditActorSummary>>> GetAuditActors()
    {
        var actors = await adminPrivacyRepository.GetAuditActorsAsync();
        return Ok(actors.Select(a => new AuditActorSummary(a.UserId, a.DisplayName, a.Username)).ToList());
    }

    [HttpGet("audit-logs/export")]
    public async Task<IActionResult> ExportAuditLogs(
        [FromQuery] string? search,
        [FromQuery] Guid? actorId,
        [FromQuery] string? action,
        [FromQuery] string? entityType,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var rows = await adminPrivacyRepository.GetAuditLogsForExportAsync(
            new AuditLogFilterReadModel(search, actorId, action, entityType, fromDate, toDate, null, 1, 100));

        var sb = new System.Text.StringBuilder();
        sb.AppendLine("Id,Timestamp,Actor,Action,EntityType,EntityId,Details");
        foreach (var row in rows)
        {
            var actorName = row.ActorName ?? row.ActorUserId?.ToString() ?? "System";
            var details = (row.Details ?? string.Empty).Replace("\"", "\"\"");
            sb.AppendLine($"{row.Id},{row.CreatedAtUtc:O},{CsvQuote(actorName)},{row.Action},{row.EntityType},{row.EntityId},{CsvQuote(details)}");
        }

        var bytes = System.Text.Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"audit-logs-{DateTime.UtcNow:yyyy-MM-dd}.csv");
    }

    private static string CsvQuote(string value) =>
        value.Contains(',') || value.Contains('"') || value.Contains('\n') ? $"\"{value}\"" : value;
}

using TimeSheet.Application.AdminPrivacy.Queries;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class AdminPrivacyQueryService(IAdminPrivacyRepository adminPrivacyRepository) : IAdminPrivacyQueryService
{
    private static readonly (string DataType, int DefaultDays)[] Defaults =
    [
        ("timesheets", 2555),
        ("auditlogs", 365),
        ("notifications", 90),
        ("sessions", 180)
    ];

    public async Task<RetentionPolicyResult> GetRetentionPolicyAsync(CancellationToken ct = default)
    {
        var stored = await adminPrivacyRepository.GetRetentionPoliciesAsync(ct);
        return new RetentionPolicyResult(Defaults.Select(d =>
        {
            var row = stored.FirstOrDefault(s => s.DataType == d.DataType);
            return new RetentionPolicyItemResult(d.DataType, row?.RetentionDays ?? d.DefaultDays);
        }).ToList());
    }

    public async Task<RetentionPolicyResult> UpdateRetentionPolicyAsync(IReadOnlyCollection<RetentionPolicyItemResult> items, CancellationToken ct = default)
    {
        await adminPrivacyRepository.UpsertRetentionPoliciesAsync(
            items.Select(i => new RetentionPolicyReadModel(i.DataType, i.RetentionDays)),
            ct);

        return await GetRetentionPolicyAsync(ct);
    }

    public async Task<AuditLogPageResult> GetAuditLogsAsync(AuditLogFilterResult filter, CancellationToken ct = default)
    {
        var result = await adminPrivacyRepository.GetAuditLogsAsync(
            new AuditLogFilterReadModel(filter.Search, filter.ActorId, filter.Action, filter.EntityType, filter.FromDate, filter.ToDate, filter.SortOrder, filter.Page, filter.PageSize),
            ct);

        return new AuditLogPageResult(result.Items.Select(MapAuditLogEntry).ToList(), result.TotalCount, result.Page, result.PageSize);
    }

    public async Task<IReadOnlyList<AuditChangeResult>?> GetAuditChangesAsync(Guid auditLogId, CancellationToken ct = default)
    {
        var items = await adminPrivacyRepository.GetAuditChangesAsync(auditLogId, ct);
        return items?.Select(c => new AuditChangeResult(c.FieldName, c.OldValue, c.NewValue, c.ValueType)).ToList();
    }

    public async Task<IReadOnlyList<AuditLogEntryResult>> GetEntityHistoryAsync(string entityType, string entityId, int page, int pageSize, CancellationToken ct = default)
        => (await adminPrivacyRepository.GetEntityHistoryAsync(entityType, entityId, page, pageSize, ct))
            .Select(MapAuditLogEntry)
            .ToList();

    public async Task<AuditLogStatsResult> GetAuditLogStatsAsync(CancellationToken ct = default)
    {
        var stats = await adminPrivacyRepository.GetAuditStatsAsync(ct);
        return new AuditLogStatsResult(stats.TotalCount, stats.LastEventAt, stats.RetentionDays);
    }

    public async Task<IReadOnlyList<AuditActorResult>> GetAuditActorsAsync(CancellationToken ct = default)
        => (await adminPrivacyRepository.GetAuditActorsAsync(ct))
            .Select(a => new AuditActorResult(a.UserId, a.DisplayName, a.Username))
            .ToList();

    public async Task<AuditExportResult> ExportAuditLogsAsync(AuditLogFilterResult filter, CancellationToken ct = default)
    {
        var rows = await adminPrivacyRepository.GetAuditLogsForExportAsync(
            new AuditLogFilterReadModel(filter.Search, filter.ActorId, filter.Action, filter.EntityType, filter.FromDate, filter.ToDate, null, 1, 500),
            ct);

        var summaries = await adminPrivacyRepository.GetFieldChangeSummariesAsync(rows.Select(r => r.Id), ct);

        var sb = new System.Text.StringBuilder();
        sb.AppendLine("Id,Timestamp,Actor,Action,EntityType,EntityId,Details,FieldChanges");
        foreach (var row in rows)
        {
            var actorName = row.ActorName ?? row.ActorUserId?.ToString() ?? "System";
            var details = (row.Details ?? string.Empty).Replace("\"", "\"\"");
            summaries.TryGetValue(row.Id, out var fieldChanges);
            sb.AppendLine($"{row.Id},{row.CreatedAtUtc:O},{CsvQuote(actorName)},{row.Action},{row.EntityType},{row.EntityId},{CsvQuote(details)},{CsvQuote(fieldChanges ?? string.Empty)}");
        }

        return new AuditExportResult(
            $"audit-logs-{DateTime.UtcNow:yyyy-MM-dd}.csv",
            "text/csv",
            System.Text.Encoding.UTF8.GetBytes(sb.ToString()));
    }

    private static AuditLogEntryResult MapAuditLogEntry(AuditLogListItemReadModel a)
        => new(a.Id, a.ActorUserId, a.ActorName, a.ActorUsername, a.Action, a.EntityType, a.EntityId, a.Details, a.CreatedAtUtc, a.HasFieldChanges);

    private static AuditLogEntryResult MapAuditLogEntry(AuditLogExportItemReadModel a)
        => new(a.Id, a.ActorUserId, a.ActorName, null, a.Action, a.EntityType, a.EntityId, a.Details, a.CreatedAtUtc, false);

    private static string CsvQuote(string value) =>
        value.Contains(',') || value.Contains('"') || value.Contains('\n')
            ? $"\"{value}\""
            : value;
}

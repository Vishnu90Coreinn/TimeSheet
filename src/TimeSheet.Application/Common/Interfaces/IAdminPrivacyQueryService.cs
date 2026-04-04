using TimeSheet.Application.AdminPrivacy.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface IAdminPrivacyQueryService
{
    Task<RetentionPolicyResult> GetRetentionPolicyAsync(CancellationToken ct = default);
    Task<RetentionPolicyResult> UpdateRetentionPolicyAsync(IReadOnlyCollection<RetentionPolicyItemResult> items, CancellationToken ct = default);
    Task<AuditLogPageResult> GetAuditLogsAsync(AuditLogFilterResult filter, CancellationToken ct = default);
    Task<IReadOnlyList<AuditChangeResult>?> GetAuditChangesAsync(Guid auditLogId, CancellationToken ct = default);
    Task<IReadOnlyList<AuditLogEntryResult>> GetEntityHistoryAsync(string entityType, string entityId, int page, int pageSize, CancellationToken ct = default);
    Task<AuditLogStatsResult> GetAuditLogStatsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<AuditActorResult>> GetAuditActorsAsync(CancellationToken ct = default);
    Task<AuditExportResult> ExportAuditLogsAsync(AuditLogFilterResult filter, CancellationToken ct = default);
}

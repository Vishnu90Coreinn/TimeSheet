namespace TimeSheet.Domain.Interfaces;

public interface IAdminPrivacyRepository
{
    Task<IReadOnlyList<RetentionPolicyReadModel>> GetRetentionPoliciesAsync(CancellationToken ct = default);
    Task UpsertRetentionPoliciesAsync(IEnumerable<RetentionPolicyReadModel> items, CancellationToken ct = default);

    Task<AuditLogPageReadModel> GetAuditLogsAsync(AuditLogFilterReadModel filter, CancellationToken ct = default);
    Task<IReadOnlyList<AuditLogChangeReadModel>?> GetAuditChangesAsync(Guid auditLogId, CancellationToken ct = default);
    Task<IReadOnlyList<AuditLogListItemReadModel>> GetEntityHistoryAsync(
        string entityType,
        string entityId,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<AuditLogStatsReadModel> GetAuditStatsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<AuditActorReadModel>> GetAuditActorsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<AuditLogExportItemReadModel>> GetAuditLogsForExportAsync(
        AuditLogFilterReadModel filter,
        CancellationToken ct = default);

    /// <summary>
    /// Returns a pipe-separated "Field: Before → After" summary string keyed by AuditLog ID,
    /// for use in CSV exports. Only IDs that have field-level change rows are returned.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, string>> GetFieldChangeSummariesAsync(
        IEnumerable<Guid> auditLogIds,
        CancellationToken ct = default);
}

public record RetentionPolicyReadModel(string DataType, int RetentionDays);

public record AuditLogFilterReadModel(
    string? Search,
    Guid? ActorId,
    string? Action,
    string? EntityType,
    DateTime? FromDate,
    DateTime? ToDate,
    string? SortOrder,
    int Page,
    int PageSize);

public record AuditLogListItemReadModel(
    Guid Id,
    Guid? ActorUserId,
    string? ActorName,
    string? ActorUsername,
    string Action,
    string EntityType,
    string EntityId,
    string? Details,
    DateTime CreatedAtUtc,
    bool HasFieldChanges);

public record AuditLogPageReadModel(
    IReadOnlyList<AuditLogListItemReadModel> Items,
    int TotalCount,
    int Page,
    int PageSize);

public record AuditLogChangeReadModel(
    string FieldName,
    string? OldValue,
    string? NewValue,
    string? ValueType);

public record AuditLogStatsReadModel(int TotalCount, DateTime? LastEventAt, int RetentionDays);
public record AuditActorReadModel(Guid UserId, string DisplayName, string Username);
public record AuditLogExportItemReadModel(
    Guid Id,
    Guid? ActorUserId,
    string? ActorName,
    string Action,
    string EntityType,
    string EntityId,
    string? Details,
    DateTime CreatedAtUtc);

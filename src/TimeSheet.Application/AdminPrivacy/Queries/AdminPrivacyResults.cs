namespace TimeSheet.Application.AdminPrivacy.Queries;

public record RetentionPolicyItemResult(string DataType, int RetentionDays);
public record RetentionPolicyResult(IReadOnlyList<RetentionPolicyItemResult> Policies);

public record AuditLogFilterResult(
    string? Search,
    Guid? ActorId,
    string? Action,
    string? EntityType,
    DateTime? FromDate,
    DateTime? ToDate,
    string? SortOrder,
    int Page,
    int PageSize);

public record AuditLogEntryResult(
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

public record AuditLogPageResult(
    IReadOnlyList<AuditLogEntryResult> Items,
    int TotalCount,
    int Page,
    int PageSize);

public record AuditChangeResult(string FieldName, string? OldValue, string? NewValue, string? ValueType);
public record AuditActorResult(Guid UserId, string DisplayName, string Username);
public record AuditLogStatsResult(int TotalCount, DateTime? LastEventAt, int RetentionDays);
public record AuditExportResult(string FileName, string ContentType, byte[] Content);

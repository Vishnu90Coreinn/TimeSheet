namespace TimeSheet.Api.Dtos;

public record ExportRequestResponse(Guid Id, string Status, DateTime RequestedAt, DateTime? CompletedAt, string? DownloadUrl);
public record ConsentRequest(string ConsentType, bool Granted);
public record RetentionPolicyItem(string DataType, int RetentionDays);
public record RetentionPolicyResponse(IReadOnlyList<RetentionPolicyItem> Policies);
public record AuditLogEntry(
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
public record AuditChangeDto(string FieldName, string? OldValue, string? NewValue, string? ValueType);
public record AuditLogPageResponse(IReadOnlyList<AuditLogEntry> Items, int TotalCount, int Page, int PageSize);
public record AuditActorSummary(Guid UserId, string DisplayName, string Username);
public record AuditLogStats(int TotalCount, DateTime? LastEventAt, int RetentionDays);

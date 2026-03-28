namespace TimeSheet.Api.Dtos;

public record ExportRequestResponse(Guid Id, string Status, DateTime RequestedAt, DateTime? CompletedAt, string? DownloadUrl);
public record ConsentRequest(string ConsentType, bool Granted);
public record RetentionPolicyItem(string DataType, int RetentionDays);
public record RetentionPolicyResponse(IReadOnlyList<RetentionPolicyItem> Policies);
public record AuditLogEntry(Guid Id, Guid? ActorUserId, string Action, string EntityType, string EntityId, string? Details, DateTime CreatedAtUtc);
public record AuditLogPageResponse(IReadOnlyList<AuditLogEntry> Items, int TotalCount, int Page, int PageSize);

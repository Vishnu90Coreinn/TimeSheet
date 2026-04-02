namespace TimeSheet.Domain.Entities;

public class AuditLog
{
    public Guid Id { get; set; }
    public Guid? ActorUserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string? Details { get; set; }
    public bool HasFieldChanges { get; set; }
    public string? SourceContext { get; set; } = "ManualCall";
    public string? CorrelationId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<AuditLogChange> Changes { get; set; } = [];
}

public class AuditLogChange
{
    public Guid Id { get; set; }
    public Guid AuditLogId { get; set; }
    public string FieldName { get; set; } = string.Empty;
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? ValueType { get; set; }
    public bool IsMasked { get; set; }

    public AuditLog AuditLog { get; set; } = null!;
}

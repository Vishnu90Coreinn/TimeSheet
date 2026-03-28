namespace TimeSheet.Domain.Entities;

public class RetentionPolicy
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string DataType { get; set; } = string.Empty;   // "timesheets" | "auditlogs" | "notifications" | "sessions"
    public int RetentionDays { get; set; }                  // e.g. 2555 = 7 years
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

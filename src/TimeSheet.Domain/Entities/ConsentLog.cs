namespace TimeSheet.Domain.Entities;

public class ConsentLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string ConsentType { get; set; } = string.Empty;  // e.g. "analytics", "marketing"
    public bool Granted { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? IpAddress { get; set; }
}

namespace TimeSheet.Domain.Entities;

public class DataExportRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public string? DownloadUrl { get; set; }
    public string Status { get; set; } = "Pending"; // Pending | Completed | Failed
}

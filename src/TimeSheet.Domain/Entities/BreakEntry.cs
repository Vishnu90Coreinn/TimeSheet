namespace TimeSheet.Domain.Entities;

public class BreakEntry
{
    public Guid Id { get; set; }
    public Guid WorkSessionId { get; set; }
    public WorkSession WorkSession { get; set; } = null!;
    public DateTime StartAtUtc { get; set; }
    public DateTime? EndAtUtc { get; set; }
    public int DurationMinutes { get; set; }
    public bool IsManualEdit { get; set; }
}

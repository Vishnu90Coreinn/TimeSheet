namespace TimeSheet.Api.Models;

public class TimerSession
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public Guid CategoryId { get; set; }
    public TaskCategory Category { get; set; } = null!;

    public string? Note { get; set; }

    public DateTime StartedAtUtc { get; set; }
    public DateTime? StoppedAtUtc { get; set; }
    public int? DurationMinutes { get; set; }

    public Guid? ConvertedToEntryId { get; set; }
    public TimesheetEntry? ConvertedToEntry { get; set; }
}

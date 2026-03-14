namespace TimeSheet.Api.Models;

public enum WorkSessionStatus
{
    Active = 1,
    Completed = 2,
    MissingCheckout = 3
}

public class WorkSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateOnly WorkDate { get; set; }
    public DateTime CheckInAtUtc { get; set; }
    public DateTime? CheckOutAtUtc { get; set; }
    public WorkSessionStatus Status { get; set; } = WorkSessionStatus.Active;
    public bool HasAttendanceException { get; set; }
    public ICollection<BreakEntry> Breaks { get; set; } = new List<BreakEntry>();
}

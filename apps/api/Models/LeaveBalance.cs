namespace TimeSheet.Api.Models;

public class LeaveBalance
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid LeaveTypeId { get; set; }
    public LeaveType LeaveType { get; set; } = null!;
    public int Year { get; set; }
    public int AllocatedDays { get; set; }
    public int ManualAdjustmentDays { get; set; } = 0;
    public string? Note { get; set; }
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

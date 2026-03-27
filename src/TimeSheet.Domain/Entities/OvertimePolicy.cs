namespace TimeSheet.Domain.Entities;

public class OvertimePolicy
{
    public Guid Id { get; set; }
    public Guid WorkPolicyId { get; set; }
    public WorkPolicy WorkPolicy { get; set; } = null!;
    public decimal DailyOvertimeAfterHours { get; set; } = 8m;
    public decimal WeeklyOvertimeAfterHours { get; set; } = 40m;
    public decimal OvertimeMultiplier { get; set; } = 1.5m;
    public bool CompOffEnabled { get; set; } = false;
    public int CompOffExpiryDays { get; set; } = 90;
}


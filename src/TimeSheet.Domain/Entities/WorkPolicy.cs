namespace TimeSheet.Domain.Entities;

public class WorkPolicy
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int DailyExpectedMinutes { get; set; } = 480;
    public int WorkDaysPerWeek { get; set; } = 5;
    public int FixedLunchDeductionMinutes { get; set; } = 45;
    public int LowGrossThresholdMinutes { get; set; } = 300;
    public bool SkipLunchDeductionForLowGross { get; set; } = true;
    public bool AllowManualBreakEdits { get; set; } = false;
    public int TimesheetBackdateWindowDays { get; set; } = 7;
    public bool RequireMismatchReason { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public OvertimePolicy? OvertimePolicy { get; set; }
}

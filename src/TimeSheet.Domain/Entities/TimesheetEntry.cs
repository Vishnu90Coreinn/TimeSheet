namespace TimeSheet.Domain.Entities;

public class TimesheetEntry
{
    public Guid Id { get; set; }
    public Guid TimesheetId { get; set; }
    public Timesheet Timesheet { get; set; } = null!;

    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public Guid TaskCategoryId { get; set; }
    public TaskCategory TaskCategory { get; set; } = null!;

    public int Minutes { get; set; }
    public string? Notes { get; set; }
}

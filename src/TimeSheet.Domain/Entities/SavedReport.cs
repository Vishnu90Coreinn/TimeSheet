using TimeSheet.Domain.Common;
using TimeSheet.Domain.Enums;

namespace TimeSheet.Domain.Entities;

public class SavedReport : Entity
{
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ReportKey { get; set; } = string.Empty;
    public string FiltersJson { get; set; } = "{}";
    public ScheduleType ScheduleType { get; set; } = ScheduleType.None;
    public DayOfWeek? ScheduleDayOfWeek { get; set; }
    public int ScheduleHour { get; set; } = 8;
    public string RecipientEmailsJson { get; set; } = "[]";
    public DateTime? LastRunAt { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public User? User { get; set; }
}

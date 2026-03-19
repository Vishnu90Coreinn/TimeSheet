namespace TimeSheet.Domain.Entities;

public class TimesheetTemplate
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string EntriesJson { get; set; } = "[]"; // JSON array of TemplateEntryData
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

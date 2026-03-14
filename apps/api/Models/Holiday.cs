namespace TimeSheet.Api.Models;

public class Holiday
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateOnly Date { get; set; }
    public bool IsRecurring { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

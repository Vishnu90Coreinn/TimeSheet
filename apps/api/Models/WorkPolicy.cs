namespace TimeSheet.Api.Models;

public class WorkPolicy
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int DailyExpectedMinutes { get; set; } = 480;
    public bool IsActive { get; set; } = true;
}

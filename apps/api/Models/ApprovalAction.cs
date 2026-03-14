namespace TimeSheet.Api.Models;

public enum ApprovalActionType
{
    Approved = 0,
    Rejected = 1,
    PushedBack = 2
}

public class ApprovalAction
{
    public Guid Id { get; set; }
    public Guid TimesheetId { get; set; }
    public Timesheet Timesheet { get; set; } = null!;
    public Guid ManagerUserId { get; set; }
    public User ManagerUser { get; set; } = null!;
    public ApprovalActionType Action { get; set; }
    public string Comment { get; set; } = string.Empty;
    public DateTime ActionedAtUtc { get; set; } = DateTime.UtcNow;
}

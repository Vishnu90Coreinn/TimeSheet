namespace TimeSheet.Api.Models;

public enum NotificationType
{
    MissingCheckout,
    MissingTimesheet,
    PendingApproval,
    StatusChange
}

public class Notification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public NotificationType Type { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

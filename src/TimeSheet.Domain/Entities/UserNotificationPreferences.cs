namespace TimeSheet.Domain.Entities;

public class UserNotificationPreferences
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    // In-app notification toggles
    public bool OnApproval { get; set; } = true;
    public bool OnRejection { get; set; } = true;
    public bool OnLeaveStatus { get; set; } = true;
    public bool OnReminder { get; set; } = true;

    // Channel toggles (email is infrastructure — off by default until SMTP is configured)
    public bool InAppEnabled { get; set; } = true;
    public bool EmailEnabled { get; set; } = false;
}

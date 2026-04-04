namespace TimeSheet.Application.Profile.Queries;

public record MyProfileResult(
    Guid Id,
    string Username,
    string DisplayName,
    string Email,
    string EmployeeId,
    string Role,
    string? DepartmentName,
    string? WorkPolicyName,
    string? LeavePolicyName,
    string? ManagerUsername,
    string? AvatarDataUrl,
    string TimeZoneId);

public record NotificationPreferencesResult(
    bool OnApproval,
    bool OnRejection,
    bool OnLeaveStatus,
    bool OnReminder,
    bool InAppEnabled,
    bool EmailEnabled);

public enum ProfileUpdateOutcome
{
    Success,
    NotFound,
    Duplicate,
    InvalidTimeZone
}

public enum PasswordChangeOutcome
{
    Success,
    NotFound,
    InvalidCurrentPassword
}

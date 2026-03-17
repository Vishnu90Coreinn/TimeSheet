namespace TimeSheet.Api.Dtos;

public record TeamMemberStatusResponse(
    Guid UserId,
    string Username,
    string DisplayName,
    string? AvatarDataUrl,
    // Attendance
    string Attendance,           // checkedIn | checkedOut | onLeave | absent
    string? CheckInAtUtc,        // ISO 8601 UTC — client converts to local time
    string? CheckOutAtUtc,       // ISO 8601 UTC — client converts to local time
    // Week progress
    int WeekLoggedMinutes,
    int WeekExpectedMinutes,
    // Timesheet
    string TodayTimesheetStatus, // draft | submitted | approved | rejected | missing
    int PendingApprovalCount
);

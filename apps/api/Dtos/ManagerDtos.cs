namespace TimeSheet.Api.Dtos;

public record TeamMemberStatusResponse(
    Guid UserId,
    string Username,
    string DisplayName,
    string? AvatarDataUrl,
    // Attendance
    string Attendance,          // checkedIn | checkedOut | onLeave | absent
    string? CheckInTime,        // HH:mm UTC
    string? CheckOutTime,       // HH:mm UTC
    // Week progress
    int WeekLoggedMinutes,
    int WeekExpectedMinutes,
    // Timesheet
    string TodayTimesheetStatus, // draft | submitted | approved | rejected | missing
    int PendingApprovalCount
);

namespace TimeSheet.Api.Application.Common.Constants;

public static class ApiMessages
{
    public const string LeaveDateRangeInvalid = "ToDate must be on or after FromDate.";
    public const string LeaveNoWorkingDays = "The selected date range contains no working days.";
    public const string LeaveOverlapsExisting = "You already have a leave request on {0}. Cancel it first before re-applying.";
    public const string LeaveRequestNotFound = "Leave request not found.";
    public const string LeaveCancelPendingOnly = "Only pending leave requests can be cancelled.";
    public const string LeaveReviewPendingOnly = "Only pending leaves can be reviewed.";
    public const string LeaveReviewForbidden = "You are not allowed to review this leave request.";
    public const string LeaveRejectionCommentRequired = "Comment is required when rejecting leave.";
    public const string LeaveReviewNotificationTitle = "Leave Request Updated";
    public const string LeaveReviewAuditMessage = "Manager reviewed leave for {0}";
    public const string LeaveReviewNotificationMessage = "Your leave request for {0:yyyy-MM-dd} has been {1}.";
    public const string RoleAlreadyExists = "Role already exists.";
    public const string RoleNameRequired = "Role name is required.";
    public const string HolidayNotFound = "Holiday not found.";
    public const string HolidayCreatedLog = "Holiday created: {Name} on {Date}";
    public const string HolidayUpdatedLog = "Holiday updated: {Id}";
    public const string HolidayDeletedLog = "Holiday deleted: {Id}";
    public const string ProjectNotFound = "Project not found.";
    public const string AnomalyNotFound = "Anomaly notification not found.";
    public const string TaskCategoryNameRequired = "Task category name is required.";
    public const string TaskCategoryNotFound = "Task category not found.";
    public const string TaskCategoryAlreadyExists = "Task category already exists.";
}

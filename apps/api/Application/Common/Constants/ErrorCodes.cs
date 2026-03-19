namespace TimeSheet.Api.Application.Common.Constants;

public static class ErrorCodes
{
    public const string InvalidDateRange = "LEAVE_INVALID_DATE_RANGE";
    public const string NoWorkingDays = "LEAVE_NO_WORKING_DAYS";
    public const string DuplicateDates = "LEAVE_DUPLICATE_DATES";
    public const string LeaveNotFound = "LEAVE_NOT_FOUND";
    public const string LeaveCancelInvalidStatus = "LEAVE_CANCEL_INVALID_STATUS";
    public const string LeaveReviewInvalidStatus = "LEAVE_REVIEW_INVALID_STATUS";
    public const string LeaveReviewForbidden = "LEAVE_REVIEW_FORBIDDEN";
    public const string LeaveRejectionCommentRequired = "LEAVE_REJECTION_COMMENT_REQUIRED";
    public const string RoleAlreadyExists = "ROLE_ALREADY_EXISTS";
    public const string HolidayNotFound = "HOLIDAY_NOT_FOUND";
    public const string ProjectNotFound = "PROJECT_NOT_FOUND";
    public const string AnomalyNotFound = "ANOMALY_NOT_FOUND";
    public const string TaskCategoryNotFound = "TASK_CATEGORY_NOT_FOUND";
    public const string TaskCategoryAlreadyExists = "TASK_CATEGORY_ALREADY_EXISTS";
}

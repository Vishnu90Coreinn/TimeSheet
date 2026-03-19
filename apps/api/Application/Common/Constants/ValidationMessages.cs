namespace TimeSheet.Api.Application.Common.Constants;

public static class ValidationMessages
{
    public const string PageNumberMustBePositive = "PageNumber must be greater than zero.";
    public const string PageSizeMustBePositive = "PageSize must be greater than zero.";
    public const string InvalidSortDirection = "SortDirection must be 'asc' or 'desc'.";
    public const string InvalidStatusFilter = "Status must be one of: pending, approved, rejected.";
    public const string InvalidDateRange = "FromDate must be on or before ToDate.";
}

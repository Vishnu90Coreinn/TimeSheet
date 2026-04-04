using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record PagedResponse<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    string? SortBy = null,
    string? SortDir = null);

public record UsersListQuery(
    string? Search = null,
    string? Role = null,
    Guid? DepartmentId = null,
    bool? IsActive = null,
    string? SortBy = "username",
    string? SortDir = "asc",
    [Range(1, 100000)] int Page = 1,
    [Range(1, 200)] int PageSize = 25);

public record ProjectsListQuery(
    string? Search = null,
    string? Status = null,
    string? SortBy = "name",
    string? SortDir = "asc",
    [Range(1, 100000)] int Page = 1,
    [Range(1, 200)] int PageSize = 25);

public record TaskCategoriesListQuery(
    string? Search = null,
    bool? IsActive = null,
    bool? IsBillable = null,
    string? SortBy = "name",
    string? SortDir = "asc",
    [Range(1, 100000)] int Page = 1,
    [Range(1, 200)] int PageSize = 25);

public record HolidaysListQuery(
    int? Year = null,
    string? Search = null,
    bool? IsRecurring = null,
    string? SortBy = "date",
    string? SortDir = "asc",
    [Range(1, 100000)] int Page = 1,
    [Range(1, 200)] int PageSize = 25);

public record LeavePoliciesListQuery(
    string? Search = null,
    bool? IsActive = null,
    string? SortBy = "name",
    string? SortDir = "asc",
    [Range(1, 100000)] int Page = 1,
    [Range(1, 200)] int PageSize = 25);

public record WorkPoliciesListQuery(
    string? Search = null,
    bool? IsActive = null,
    string? SortBy = "name",
    string? SortDir = "asc",
    [Range(1, 100000)] int Page = 1,
    [Range(1, 200)] int PageSize = 25);

public record PendingTimesheetsListQuery(
    string? Search = null,
    bool? HasMismatch = null,
    string? SortBy = "workDate",
    string? SortDir = "desc",
    [Range(1, 100000)] int Page = 1,
    [Range(1, 200)] int PageSize = 25);

public record LeaveRequestsListQuery(
    string? Search = null,
    string? SortBy = "leaveDate",
    string? SortDir = "desc",
    [Range(1, 100000)] int Page = 1,
    [Range(1, 200)] int PageSize = 25);

public record TeamStatusListQuery(
    DateOnly? Date = null,
    string? Search = null,
    string? Attendance = null,
    string? TimesheetStatus = null,
    string? SortBy = "username",
    string? SortDir = "asc",
    [Range(1, 100000)] int Page = 1,
    [Range(1, 200)] int PageSize = 25);

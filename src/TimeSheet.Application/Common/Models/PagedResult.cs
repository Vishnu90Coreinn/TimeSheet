namespace TimeSheet.Application.Common.Models;

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    string? SortBy = null,
    string? SortDir = null);

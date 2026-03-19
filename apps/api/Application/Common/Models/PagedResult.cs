namespace TimeSheet.Api.Application.Common.Models;

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int PageNumber,
    int PageSize,
    bool FetchAll);

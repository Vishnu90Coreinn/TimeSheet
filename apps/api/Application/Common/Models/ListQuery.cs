namespace TimeSheet.Api.Application.Common.Models;

public class ListQuery
{
    public int PageNumber { get; init; } = 1;
    public int PageSize { get; init; } = 10;
    public string? SortBy { get; init; }
    public string? SortDirection { get; init; } = "desc";
    public bool FetchAll { get; init; } = true;
}

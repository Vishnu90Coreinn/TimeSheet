using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Queries;

public record GetTaskCategoriesPageQuery(
    string? Search,
    bool? IsActive,
    bool? IsBillable,
    string SortBy,
    bool Descending,
    int Page,
    int PageSize) : IRequest<Result<PagedResult<TaskCategoryResult>>>;

using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Projects.Queries;

public record GetProjectsPageQuery(
    string? Search,
    string? Status,
    string SortBy,
    bool Descending,
    int Page,
    int PageSize) : IRequest<Result<PagedResult<ProjectListItemResult>>>;

public record ProjectListItemResult(
    Guid Id,
    string Name,
    string Code,
    bool IsActive,
    bool IsArchived,
    int BudgetedHours);

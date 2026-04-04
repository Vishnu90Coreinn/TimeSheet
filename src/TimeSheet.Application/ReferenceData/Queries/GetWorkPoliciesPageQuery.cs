using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Queries;

public record GetWorkPoliciesPageQuery(
    string? Search,
    bool? IsActive,
    string SortBy,
    bool Descending,
    int Page,
    int PageSize) : IRequest<Result<PagedResult<WorkPolicyResult>>>;

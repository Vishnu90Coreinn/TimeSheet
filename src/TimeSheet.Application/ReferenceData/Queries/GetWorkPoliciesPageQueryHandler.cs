using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Queries;

public class GetWorkPoliciesPageQueryHandler(IReferenceDataQueryService referenceDataQueryService)
    : IRequestHandler<GetWorkPoliciesPageQuery, Result<PagedResult<WorkPolicyResult>>>
{
    public async Task<Result<PagedResult<WorkPolicyResult>>> Handle(GetWorkPoliciesPageQuery request, CancellationToken cancellationToken)
    {
        var page = await referenceDataQueryService.GetWorkPoliciesPageAsync(
            request.Search,
            request.IsActive,
            request.SortBy,
            request.Descending,
            request.Page,
            request.PageSize,
            cancellationToken);
        return Result<PagedResult<WorkPolicyResult>>.Success(page);
    }
}

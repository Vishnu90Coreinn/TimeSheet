using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public class GetLeavePoliciesPageQueryHandler(
    ILeaveQueryService leaveQuery,
    ICurrentUserService currentUser)
    : IRequestHandler<GetLeavePoliciesPageQuery, Result<PagedResult<LeavePolicyResult>>>
{
    public async Task<Result<PagedResult<LeavePolicyResult>>> Handle(GetLeavePoliciesPageQuery request, CancellationToken ct)
    {
        if (!currentUser.IsAdmin && !currentUser.IsManager)
            return Result<PagedResult<LeavePolicyResult>>.Forbidden("Only admins and managers can view leave policies.");

        var page = await leaveQuery.GetPoliciesPageAsync(
            request.Search,
            request.IsActive,
            request.SortBy,
            request.Descending,
            request.Page,
            request.PageSize,
            ct);

        return Result<PagedResult<LeavePolicyResult>>.Success(page);
    }
}

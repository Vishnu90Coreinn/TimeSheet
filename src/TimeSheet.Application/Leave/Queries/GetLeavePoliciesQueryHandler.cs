using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public class GetLeavePoliciesQueryHandler(
    ILeaveQueryService leaveQuery,
    ICurrentUserService currentUser)
    : IRequestHandler<GetLeavePoliciesQuery, Result<List<LeavePolicyResult>>>
{
    public async Task<Result<List<LeavePolicyResult>>> Handle(GetLeavePoliciesQuery request, CancellationToken ct)
    {
        if (!currentUser.IsAdmin && !currentUser.IsManager)
            return Result<List<LeavePolicyResult>>.Forbidden("Only admins and managers can view leave policies.");

        var items = await leaveQuery.GetPoliciesAsync(ct);
        return Result<List<LeavePolicyResult>>.Success(items);
    }
}

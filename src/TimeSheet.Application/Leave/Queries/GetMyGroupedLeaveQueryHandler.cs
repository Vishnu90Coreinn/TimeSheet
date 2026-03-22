using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public class GetMyGroupedLeaveQueryHandler(
    ILeaveQueryService leaveQuery,
    ICurrentUserService currentUser)
    : IRequestHandler<GetMyGroupedLeaveQuery, Result<List<LeaveGroupResult>>>
{
    public async Task<Result<List<LeaveGroupResult>>> Handle(GetMyGroupedLeaveQuery request, CancellationToken ct)
    {
        var items = await leaveQuery.GetMyGroupedRequestsAsync(currentUser.UserId, ct);
        return Result<List<LeaveGroupResult>>.Success(items);
    }
}

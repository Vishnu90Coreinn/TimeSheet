using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public class GetPendingLeaveRequestsQueryHandler(
    ILeaveQueryService leaveQuery,
    ICurrentUserService currentUser)
    : IRequestHandler<GetPendingLeaveRequestsQuery, Result<List<LeaveRequestResult>>>
{
    public async Task<Result<List<LeaveRequestResult>>> Handle(GetPendingLeaveRequestsQuery request, CancellationToken ct)
    {
        var items = await leaveQuery.GetPendingForManagerAsync(currentUser.UserId, currentUser.IsAdmin, ct);
        return Result<List<LeaveRequestResult>>.Success(items);
    }
}

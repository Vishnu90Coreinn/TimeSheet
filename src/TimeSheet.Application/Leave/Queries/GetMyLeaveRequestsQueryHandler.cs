using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public class GetMyLeaveRequestsQueryHandler(
    ILeaveQueryService leaveQuery,
    ICurrentUserService currentUser)
    : IRequestHandler<GetMyLeaveRequestsQuery, Result<List<LeaveRequestResult>>>
{
    public async Task<Result<List<LeaveRequestResult>>> Handle(GetMyLeaveRequestsQuery request, CancellationToken ct)
    {
        var items = await leaveQuery.GetMyRequestsAsync(currentUser.UserId, ct);
        return Result<List<LeaveRequestResult>>.Success(items);
    }
}

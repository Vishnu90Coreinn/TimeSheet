using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public class GetPendingLeaveRequestsQueryHandler(
    ILeaveQueryService leaveQuery,
    ICurrentUserService currentUser)
    : IRequestHandler<GetPendingLeaveRequestsQuery, Result<PagedResult<LeaveRequestResult>>>
{
    public async Task<Result<PagedResult<LeaveRequestResult>>> Handle(GetPendingLeaveRequestsQuery request, CancellationToken ct)
    {
        var page = await leaveQuery.GetPendingForManagerPageAsync(
            currentUser.UserId,
            currentUser.IsAdmin,
            request.Search,
            request.SortBy,
            request.Descending,
            request.Page,
            request.PageSize,
            ct);
        return Result<PagedResult<LeaveRequestResult>>.Success(page);
    }
}

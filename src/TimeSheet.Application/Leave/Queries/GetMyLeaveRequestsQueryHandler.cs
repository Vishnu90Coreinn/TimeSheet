using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public class GetMyLeaveRequestsQueryHandler(
    ILeaveQueryService leaveQuery,
    ICurrentUserService currentUser)
    : IRequestHandler<GetMyLeaveRequestsQuery, Result<PagedResult<LeaveRequestResult>>>
{
    public async Task<Result<PagedResult<LeaveRequestResult>>> Handle(GetMyLeaveRequestsQuery request, CancellationToken ct)
    {
        var page = await leaveQuery.GetMyRequestsPageAsync(
            currentUser.UserId,
            request.Search,
            request.SortBy,
            request.Descending,
            request.Page,
            request.PageSize,
            ct);
        return Result<PagedResult<LeaveRequestResult>>.Success(page);
    }
}

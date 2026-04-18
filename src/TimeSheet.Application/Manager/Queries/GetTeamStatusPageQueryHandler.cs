using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Manager.Queries;

public class GetTeamStatusPageQueryHandler(
    IManagerQueryService managerQueryService,
    ICurrentUserService currentUser)
    : IRequestHandler<GetTeamStatusPageQuery, Result<PagedResult<TeamMemberStatusResult>>>
{
    public async Task<Result<PagedResult<TeamMemberStatusResult>>> Handle(GetTeamStatusPageQuery request, CancellationToken cancellationToken)
    {
        var page = await managerQueryService.GetTeamStatusPageAsync(
            currentUser.UserId,
            request.Date,
            request.Search,
            request.Attendance,
            request.TimesheetStatus,
            request.SortBy,
            request.Descending,
            request.Page,
            request.PageSize,
            cancellationToken);

        return Result<PagedResult<TeamMemberStatusResult>>.Success(page);
    }
}

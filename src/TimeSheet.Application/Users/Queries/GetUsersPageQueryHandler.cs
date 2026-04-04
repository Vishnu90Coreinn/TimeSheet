using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Users.Queries;

public class GetUsersPageQueryHandler(IUserQueryService userQueryService)
    : IRequestHandler<GetUsersPageQuery, Result<PagedResult<UserListItemResult>>>
{
    public async Task<Result<PagedResult<UserListItemResult>>> Handle(GetUsersPageQuery request, CancellationToken cancellationToken)
    {
        var page = await userQueryService.GetUsersPageAsync(
            request.Search,
            request.Role,
            request.DepartmentId,
            request.IsActive,
            request.SortBy,
            request.Descending,
            request.Page,
            request.PageSize,
            cancellationToken);

        return Result<PagedResult<UserListItemResult>>.Success(page);
    }
}

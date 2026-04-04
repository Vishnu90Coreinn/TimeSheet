using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Projects.Queries;

public class GetProjectsPageQueryHandler(IProjectQueryService projectQueryService)
    : IRequestHandler<GetProjectsPageQuery, Result<PagedResult<ProjectListItemResult>>>
{
    public async Task<Result<PagedResult<ProjectListItemResult>>> Handle(GetProjectsPageQuery request, CancellationToken cancellationToken)
    {
        var page = await projectQueryService.GetProjectsPageAsync(
            request.Search,
            request.Status,
            request.SortBy,
            request.Descending,
            request.Page,
            request.PageSize,
            cancellationToken);

        return Result<PagedResult<ProjectListItemResult>>.Success(page);
    }
}

using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Queries;

public class GetTaskCategoriesPageQueryHandler(IReferenceDataQueryService referenceDataQueryService)
    : IRequestHandler<GetTaskCategoriesPageQuery, Result<PagedResult<TaskCategoryResult>>>
{
    public async Task<Result<PagedResult<TaskCategoryResult>>> Handle(GetTaskCategoriesPageQuery request, CancellationToken cancellationToken)
    {
        var page = await referenceDataQueryService.GetTaskCategoriesPageAsync(
            request.Search,
            request.IsActive,
            request.IsBillable,
            request.SortBy,
            request.Descending,
            request.Page,
            request.PageSize,
            cancellationToken);
        return Result<PagedResult<TaskCategoryResult>>.Success(page);
    }
}

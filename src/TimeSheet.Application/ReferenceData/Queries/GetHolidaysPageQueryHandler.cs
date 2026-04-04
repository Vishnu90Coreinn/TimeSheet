using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Queries;

public class GetHolidaysPageQueryHandler(IReferenceDataQueryService referenceDataQueryService)
    : IRequestHandler<GetHolidaysPageQuery, Result<PagedResult<HolidayResult>>>
{
    public async Task<Result<PagedResult<HolidayResult>>> Handle(GetHolidaysPageQuery request, CancellationToken cancellationToken)
    {
        var page = await referenceDataQueryService.GetHolidaysPageAsync(
            request.Year,
            request.Search,
            request.IsRecurring,
            request.SortBy,
            request.Descending,
            request.Page,
            request.PageSize,
            cancellationToken);
        return Result<PagedResult<HolidayResult>>.Success(page);
    }
}

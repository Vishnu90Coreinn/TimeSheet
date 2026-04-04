using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Queries;

public record GetHolidaysPageQuery(
    int Year,
    string? Search,
    bool? IsRecurring,
    string SortBy,
    bool Descending,
    int Page,
    int PageSize) : IRequest<Result<PagedResult<HolidayResult>>>;

using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Queries;

public class GetHolidaysQueryHandler(IHolidayRepository holidayRepository, IDateTimeProvider dateTimeProvider)
    : IRequestHandler<GetHolidaysQuery, Result<List<HolidayResult>>>
{
    public async Task<Result<List<HolidayResult>>> Handle(GetHolidaysQuery request, CancellationToken cancellationToken)
    {
        var year = request.Year ?? dateTimeProvider.UtcNow.Year;
        var holidays = await holidayRepository.GetByYearAsync(year, cancellationToken);
        var result = holidays
            .Select(h => new HolidayResult(h.Id, h.Name, h.Date, h.IsRecurring, h.CreatedAtUtc))
            .ToList();
        return Result<List<HolidayResult>>.Success(result);
    }
}

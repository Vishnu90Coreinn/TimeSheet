using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Holidays.Models;
using TimeSheet.Api.Application.Holidays.Validators;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.Holidays;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Application.Holidays.Services;

public class HolidayService(IHolidayRepository holidayRepository, IHolidayListQueryValidator queryValidator) : IHolidayService
{
    public async Task<(PagedResult<HolidayResponse>? Data, OperationError? Error)> GetHolidaysAsync(HolidayListQuery query, CancellationToken cancellationToken)
    {
        var validationError = queryValidator.Validate(query);
        if (validationError is not null)
        {
            return (null, validationError);
        }

        var holidays = await holidayRepository.GetHolidaysAsync(query, cancellationToken);
        return (holidays, null);
    }

    public async Task<(HolidayResponse? Data, OperationError? Error)> CreateHolidayAsync(UpsertHolidayRequest request, CancellationToken cancellationToken)
    {
        var holiday = new Holiday
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Date = request.Date,
            IsRecurring = request.IsRecurring,
            CreatedAtUtc = DateTime.UtcNow
        };

        holidayRepository.AddHoliday(holiday);
        await holidayRepository.SaveChangesAsync(cancellationToken);

        return (new HolidayResponse(holiday.Id, holiday.Name, holiday.Date, holiday.IsRecurring, holiday.CreatedAtUtc), null);
    }

    public async Task<(HolidayResponse? Data, OperationError? Error)> UpdateHolidayAsync(Guid id, UpsertHolidayRequest request, CancellationToken cancellationToken)
    {
        var holiday = await holidayRepository.GetHolidayByIdAsync(id, cancellationToken);
        if (holiday is null)
        {
            return (null, new OperationError(ErrorCodes.HolidayNotFound, ApiMessages.HolidayNotFound, StatusCodes.Status404NotFound));
        }

        holiday.Name = request.Name.Trim();
        holiday.Date = request.Date;
        holiday.IsRecurring = request.IsRecurring;

        await holidayRepository.SaveChangesAsync(cancellationToken);
        return (new HolidayResponse(holiday.Id, holiday.Name, holiday.Date, holiday.IsRecurring, holiday.CreatedAtUtc), null);
    }

    public async Task<OperationError?> DeleteHolidayAsync(Guid id, CancellationToken cancellationToken)
    {
        var holiday = await holidayRepository.GetHolidayByIdAsync(id, cancellationToken);
        if (holiday is null)
        {
            return new OperationError(ErrorCodes.HolidayNotFound, ApiMessages.HolidayNotFound, StatusCodes.Status404NotFound);
        }

        holidayRepository.RemoveHoliday(holiday);
        await holidayRepository.SaveChangesAsync(cancellationToken);
        return null;
    }
}

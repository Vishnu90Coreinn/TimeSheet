using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Holidays.Models;

namespace TimeSheet.Api.Application.Holidays.Validators;

public interface IHolidayListQueryValidator
{
    OperationError? Validate(HolidayListQuery query);
}

public class HolidayListQueryValidator : IHolidayListQueryValidator
{
    public OperationError? Validate(HolidayListQuery query)
    {
        if (query.PageNumber <= 0)
        {
            return new OperationError("VALIDATION_PAGE_NUMBER", ValidationMessages.PageNumberMustBePositive, StatusCodes.Status400BadRequest);
        }

        if (query.PageSize <= 0)
        {
            return new OperationError("VALIDATION_PAGE_SIZE", ValidationMessages.PageSizeMustBePositive, StatusCodes.Status400BadRequest);
        }

        if (query.FromDate.HasValue && query.ToDate.HasValue && query.FromDate > query.ToDate)
        {
            return new OperationError("VALIDATION_DATE_RANGE", ValidationMessages.InvalidDateRange, StatusCodes.Status400BadRequest);
        }

        return null;
    }
}

using TimeSheet.Api.Application.Common.Models;

namespace TimeSheet.Api.Application.Holidays.Models;

public class HolidayListQuery : ListQuery
{
    public int? Year { get; init; }
    public DateOnly? FromDate { get; init; }
    public DateOnly? ToDate { get; init; }
}

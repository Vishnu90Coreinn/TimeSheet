using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Holidays.Models;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.Holidays.Services;

public interface IHolidayService
{
    Task<(PagedResult<HolidayResponse>? Data, OperationError? Error)> GetHolidaysAsync(HolidayListQuery query, CancellationToken cancellationToken);
    Task<(HolidayResponse? Data, OperationError? Error)> CreateHolidayAsync(UpsertHolidayRequest request, CancellationToken cancellationToken);
    Task<(HolidayResponse? Data, OperationError? Error)> UpdateHolidayAsync(Guid id, UpsertHolidayRequest request, CancellationToken cancellationToken);
    Task<OperationError?> DeleteHolidayAsync(Guid id, CancellationToken cancellationToken);
}

using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Holidays.Models;
using TimeSheet.Api.Application.Holidays.Services;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.Holidays.Handlers;

public interface IGetHolidaysHandler
{
    Task<(PagedResult<HolidayResponse>? Data, OperationError? Error)> HandleAsync(HolidayListQuery query, CancellationToken cancellationToken);
}

public class GetHolidaysHandler(IHolidayService holidayService) : IGetHolidaysHandler
{
    public Task<(PagedResult<HolidayResponse>? Data, OperationError? Error)> HandleAsync(HolidayListQuery query, CancellationToken cancellationToken)
        => holidayService.GetHolidaysAsync(query, cancellationToken);
}

public interface ICreateHolidayHandler
{
    Task<(HolidayResponse? Data, OperationError? Error)> HandleAsync(UpsertHolidayRequest request, CancellationToken cancellationToken);
}

public class CreateHolidayHandler(IHolidayService holidayService) : ICreateHolidayHandler
{
    public Task<(HolidayResponse? Data, OperationError? Error)> HandleAsync(UpsertHolidayRequest request, CancellationToken cancellationToken)
        => holidayService.CreateHolidayAsync(request, cancellationToken);
}

public interface IUpdateHolidayHandler
{
    Task<(HolidayResponse? Data, OperationError? Error)> HandleAsync(Guid id, UpsertHolidayRequest request, CancellationToken cancellationToken);
}

public class UpdateHolidayHandler(IHolidayService holidayService) : IUpdateHolidayHandler
{
    public Task<(HolidayResponse? Data, OperationError? Error)> HandleAsync(Guid id, UpsertHolidayRequest request, CancellationToken cancellationToken)
        => holidayService.UpdateHolidayAsync(id, request, cancellationToken);
}

public interface IDeleteHolidayHandler
{
    Task<OperationError?> HandleAsync(Guid id, CancellationToken cancellationToken);
}

public class DeleteHolidayHandler(IHolidayService holidayService) : IDeleteHolidayHandler
{
    public Task<OperationError?> HandleAsync(Guid id, CancellationToken cancellationToken)
        => holidayService.DeleteHolidayAsync(id, cancellationToken);
}

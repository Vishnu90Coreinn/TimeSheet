using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Holidays.Models;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Infrastructure.Persistence.Repositories.Holidays;

public interface IHolidayRepository
{
    Task<PagedResult<HolidayResponse>> GetHolidaysAsync(HolidayListQuery query, CancellationToken cancellationToken);
    void AddHoliday(Holiday holiday);
    Task<Holiday?> GetHolidayByIdAsync(Guid id, CancellationToken cancellationToken);
    void RemoveHoliday(Holiday holiday);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

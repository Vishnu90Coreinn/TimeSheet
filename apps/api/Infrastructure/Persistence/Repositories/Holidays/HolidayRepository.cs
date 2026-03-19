using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Holidays.Models;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Infrastructure.Persistence.Repositories.Holidays;

public class HolidayRepository(TimeSheetDbContext dbContext) : IHolidayRepository
{
    public async Task<PagedResult<HolidayResponse>> GetHolidaysAsync(HolidayListQuery query, CancellationToken cancellationToken)
    {
        var holidays = dbContext.Holidays.AsNoTracking();

        if (!query.FetchAll)
        {
            if (query.Year.HasValue)
            {
                var from = new DateOnly(query.Year.Value, 1, 1);
                var to = new DateOnly(query.Year.Value, 12, 31);
                holidays = holidays.Where(h => h.Date >= from && h.Date <= to);
            }

            if (query.FromDate.HasValue)
            {
                holidays = holidays.Where(h => h.Date >= query.FromDate.Value);
            }

            if (query.ToDate.HasValue)
            {
                holidays = holidays.Where(h => h.Date <= query.ToDate.Value);
            }
        }

        var isAscending = !string.Equals(query.SortDirection, "desc", StringComparison.OrdinalIgnoreCase);
        holidays = isAscending ? holidays.OrderBy(h => h.Date) : holidays.OrderByDescending(h => h.Date);

        var totalCount = await holidays.CountAsync(cancellationToken);

        if (!query.FetchAll)
        {
            holidays = holidays.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize);
        }

        var items = await holidays.Select(h => new HolidayResponse(h.Id, h.Name, h.Date, h.IsRecurring, h.CreatedAtUtc)).ToListAsync(cancellationToken);
        return new PagedResult<HolidayResponse>(items, totalCount, query.FetchAll ? 1 : query.PageNumber, query.FetchAll ? totalCount : query.PageSize, query.FetchAll);
    }

    public void AddHoliday(Holiday holiday) => dbContext.Holidays.Add(holiday);

    public Task<Holiday?> GetHolidayByIdAsync(Guid id, CancellationToken cancellationToken)
        => dbContext.Holidays.SingleOrDefaultAsync(h => h.Id == id, cancellationToken);

    public void RemoveHoliday(Holiday holiday) => dbContext.Holidays.Remove(holiday);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => dbContext.SaveChangesAsync(cancellationToken);
}

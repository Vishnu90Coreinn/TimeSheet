using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class HolidayRepository(TimeSheetDbContext context) : IHolidayRepository
{
    private readonly DbSet<Holiday> _dbSet = context.Set<Holiday>();

    public async Task<IReadOnlyList<Holiday>> GetByYearAsync(int year, CancellationToken ct = default)
    {
        var from = new DateOnly(year, 1, 1);
        var to = new DateOnly(year, 12, 31);
        return await _dbSet.AsNoTracking()
            .Where(h => h.Date >= from && h.Date <= to)
            .OrderBy(h => h.Date)
            .ToListAsync(ct);
    }

    public async Task<Holiday?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(h => h.Id == id, ct);

    public void Add(Holiday holiday) => _dbSet.Add(holiday);

    public void Remove(Holiday holiday) => _dbSet.Remove(holiday);
}

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

    public async Task<(IReadOnlyList<Holiday> Items, int TotalCount, int Page)> GetPagedByYearAsync(
        int year,
        string? search,
        bool? isRecurring,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var from = new DateOnly(year, 1, 1);
        var to = new DateOnly(year, 12, 31);
        var query = _dbSet.AsNoTracking()
            .Where(h => h.Date >= from && h.Date <= to)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(h => h.Name.Contains(term));
        }

        if (isRecurring.HasValue)
            query = query.Where(h => h.IsRecurring == isRecurring.Value);

        query = sortBy switch
        {
            "name" => descending ? query.OrderByDescending(h => h.Name) : query.OrderBy(h => h.Name),
            "isrecurring" => descending ? query.OrderByDescending(h => h.IsRecurring) : query.OrderBy(h => h.IsRecurring),
            _ => descending ? query.OrderByDescending(h => h.Date) : query.OrderBy(h => h.Date),
        };

        var totalCount = await query.CountAsync(ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        var safePage = page > totalPages ? totalPages : page;
        var items = await query.Skip((safePage - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return (items, totalCount, safePage);
    }

    public void Add(Holiday holiday) => _dbSet.Add(holiday);

    public void Remove(Holiday holiday) => _dbSet.Remove(holiday);
}

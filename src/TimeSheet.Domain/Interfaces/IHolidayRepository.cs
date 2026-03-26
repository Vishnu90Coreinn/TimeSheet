using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IHolidayRepository
{
    Task<IReadOnlyList<Holiday>> GetByYearAsync(int year, CancellationToken ct = default);
    Task<Holiday?> GetByIdAsync(Guid id, CancellationToken ct = default);
    void Add(Holiday holiday);
    void Remove(Holiday holiday);
}

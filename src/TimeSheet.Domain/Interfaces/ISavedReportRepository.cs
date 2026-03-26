using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface ISavedReportRepository
{
    Task<IReadOnlyList<SavedReport>> GetByUserAsync(Guid userId, CancellationToken ct = default);
    Task<SavedReport?> GetByIdAsync(Guid id, CancellationToken ct = default);
    void Add(SavedReport report);
    void Remove(SavedReport report);
}

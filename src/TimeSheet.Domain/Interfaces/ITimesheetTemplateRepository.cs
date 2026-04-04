using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface ITimesheetTemplateRepository
{
    Task<IReadOnlyList<TimesheetTemplate>> GetByUserAsync(Guid userId, CancellationToken ct = default);
    Task<TimesheetTemplate?> GetByIdForUserAsync(Guid templateId, Guid userId, bool asNoTracking = false, CancellationToken ct = default);
    void Add(TimesheetTemplate template);
    void Remove(TimesheetTemplate template);
}

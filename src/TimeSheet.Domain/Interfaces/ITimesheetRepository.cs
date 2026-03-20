using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface ITimesheetRepository
{
    Task<Timesheet?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Timesheet?> GetByUserAndDateAsync(Guid userId, DateOnly workDate, CancellationToken ct = default);
    Task<IReadOnlyList<Timesheet>> GetPendingForManagerAsync(Guid managerId, CancellationToken ct = default);
    Task<IReadOnlyList<Timesheet>> GetByUserAndDateRangeAsync(Guid userId, DateOnly from, DateOnly to, CancellationToken ct = default);
    void Add(Timesheet timesheet);
    void Remove(Timesheet timesheet);
    void RemoveEntry(TimesheetEntry entry);
    Task<IReadOnlyList<Timesheet>> GetByUserAndWeekTrackedAsync(Guid userId, DateOnly weekStart, DateOnly weekEnd, CancellationToken ct = default);
}

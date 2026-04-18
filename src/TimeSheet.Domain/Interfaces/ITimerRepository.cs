using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface ITimerRepository
{
    Task<TimerSession?> GetActiveByUserAsync(Guid userId, CancellationToken ct = default);
    Task<bool> HasActiveAsync(Guid userId, CancellationToken ct = default);
    Task<Project?> GetProjectAsync(Guid projectId, CancellationToken ct = default);
    Task<TaskCategory?> GetTaskCategoryAsync(Guid categoryId, CancellationToken ct = default);
    Task<TimerSession?> GetByIdForUserAsync(Guid timerId, Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<TimerSession>> GetByUserAndDateAsync(Guid userId, DateOnly date, CancellationToken ct = default);
    Task<Timesheet?> GetTimesheetByUserAndDateAsync(Guid userId, DateOnly workDate, CancellationToken ct = default);
    void AddTimer(TimerSession timer);
    void AddTimesheet(Timesheet timesheet);
    void AddEntry(TimesheetEntry entry);
}

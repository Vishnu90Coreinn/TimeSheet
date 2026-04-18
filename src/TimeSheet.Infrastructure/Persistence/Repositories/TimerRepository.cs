using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class TimerRepository(TimeSheetDbContext context) : ITimerRepository
{
    public async Task<TimerSession?> GetActiveByUserAsync(Guid userId, CancellationToken ct = default)
        => await context.TimerSessions
            .Include(t => t.Project)
            .Include(t => t.Category)
            .FirstOrDefaultAsync(t => t.UserId == userId && t.StoppedAtUtc == null, ct);

    public async Task<bool> HasActiveAsync(Guid userId, CancellationToken ct = default)
        => await context.TimerSessions.AnyAsync(t => t.UserId == userId && t.StoppedAtUtc == null, ct);

    public async Task<Project?> GetProjectAsync(Guid projectId, CancellationToken ct = default)
        => await context.Projects.FindAsync([projectId], ct);

    public async Task<TaskCategory?> GetTaskCategoryAsync(Guid categoryId, CancellationToken ct = default)
        => await context.TaskCategories.FindAsync([categoryId], ct);

    public async Task<TimerSession?> GetByIdForUserAsync(Guid timerId, Guid userId, CancellationToken ct = default)
        => await context.TimerSessions
            .Include(t => t.Project)
            .Include(t => t.Category)
            .FirstOrDefaultAsync(t => t.Id == timerId && t.UserId == userId, ct);

    public async Task<IReadOnlyList<TimerSession>> GetByUserAndDateAsync(Guid userId, DateOnly date, CancellationToken ct = default)
        => await context.TimerSessions.AsNoTracking()
            .Include(t => t.Project)
            .Include(t => t.Category)
            .Where(t => t.UserId == userId && DateOnly.FromDateTime(t.StartedAtUtc) == date)
            .OrderByDescending(t => t.StartedAtUtc)
            .ToListAsync(ct);

    public async Task<Timesheet?> GetTimesheetByUserAndDateAsync(Guid userId, DateOnly workDate, CancellationToken ct = default)
        => await context.Timesheets.Include(t => t.Entries).FirstOrDefaultAsync(t => t.UserId == userId && t.WorkDate == workDate, ct);

    public void AddTimer(TimerSession timer) => context.TimerSessions.Add(timer);
    public void AddTimesheet(Timesheet timesheet) => context.Timesheets.Add(timesheet);
    public void AddEntry(TimesheetEntry entry) => context.TimesheetEntries.Add(entry);
}

using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class TimesheetRepository(TimeSheetDbContext context)
    : BaseRepository<Timesheet>(context), ITimesheetRepository
{
    public async Task<Timesheet?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet
            .Include(t => t.Entries)
            .Include(t => t.ApprovalActions)
            .FirstOrDefaultAsync(t => t.Id == id, ct);

    public async Task<Timesheet?> GetByUserAndDateAsync(Guid userId, DateOnly workDate, CancellationToken ct = default)
        => await _dbSet
            .Include(t => t.Entries)
            .FirstOrDefaultAsync(t => t.UserId == userId && t.WorkDate == workDate, ct);

    public async Task<IReadOnlyList<Timesheet>> GetPendingForManagerAsync(Guid managerId, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Include(t => t.User)
            .Where(t => t.Status == TimesheetStatus.Submitted && t.User.ManagerId == managerId)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Timesheet>> GetByUserAndDateRangeAsync(
        Guid userId, DateOnly from, DateOnly to, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Include(t => t.Entries)
            .Where(t => t.UserId == userId && t.WorkDate >= from && t.WorkDate <= to)
            .OrderBy(t => t.WorkDate)
            .ToListAsync(ct);

    public void Add(Timesheet timesheet) => _dbSet.Add(timesheet);

    public void Remove(Timesheet timesheet) => _dbSet.Remove(timesheet);
}

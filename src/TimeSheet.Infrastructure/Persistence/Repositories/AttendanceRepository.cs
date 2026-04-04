using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class AttendanceRepository(TimeSheetDbContext context) : IAttendanceRepository
{
    public async Task<bool> HasActiveSessionAsync(Guid userId, CancellationToken ct = default)
        => await context.WorkSessions.AnyAsync(s => s.UserId == userId && s.Status == WorkSessionStatus.Active, ct);

    public async Task<WorkSession?> GetLatestActiveSessionAsync(Guid userId, CancellationToken ct = default)
        => await context.WorkSessions
            .Include(s => s.Breaks)
            .Where(s => s.UserId == userId && s.Status == WorkSessionStatus.Active)
            .OrderByDescending(s => s.CheckInAtUtc)
            .FirstOrDefaultAsync(ct);

    public async Task<BreakEntry?> GetBreakEntryForUserAsync(Guid breakEntryId, Guid userId, CancellationToken ct = default)
        => await context.BreakEntries
            .Include(b => b.WorkSession)
            .ThenInclude(s => s.Breaks)
            .SingleOrDefaultAsync(b => b.Id == breakEntryId && b.WorkSession.UserId == userId, ct);

    public async Task<User?> GetUserWithPolicyAsync(Guid userId, CancellationToken ct = default)
        => await context.Users
            .Include(u => u.WorkPolicy)
            .SingleOrDefaultAsync(u => u.Id == userId, ct);

    public async Task<IReadOnlyList<WorkSession>> GetSessionsByUserAndDateAsync(Guid userId, DateOnly workDate, CancellationToken ct = default)
        => await context.WorkSessions
            .Include(s => s.Breaks)
            .Where(s => s.UserId == userId && s.WorkDate == workDate)
            .OrderBy(s => s.CheckInAtUtc)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<WorkSession>> GetSessionsByUserAndRangeAsync(Guid userId, DateOnly fromDate, DateOnly toDate, CancellationToken ct = default)
        => await context.WorkSessions
            .AsNoTracking()
            .Include(s => s.Breaks)
            .Where(s => s.UserId == userId && s.WorkDate >= fromDate && s.WorkDate <= toDate)
            .OrderByDescending(s => s.WorkDate)
            .ThenBy(s => s.CheckInAtUtc)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<WorkSession>> GetStaleActiveSessionsAsync(Guid userId, DateOnly beforeDate, CancellationToken ct = default)
        => await context.WorkSessions
            .Where(s => s.UserId == userId && s.Status == WorkSessionStatus.Active && s.WorkDate < beforeDate)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<BreakEntry>> GetOpenBreakEntriesBySessionIdsAsync(IReadOnlyCollection<Guid> sessionIds, CancellationToken ct = default)
        => await context.BreakEntries
            .Where(b => sessionIds.Contains(b.WorkSessionId) && b.EndAtUtc == null)
            .ToListAsync(ct);

    public void AddWorkSession(WorkSession session) => context.WorkSessions.Add(session);

    public void AddBreakEntry(BreakEntry breakEntry) => context.BreakEntries.Add(breakEntry);
}

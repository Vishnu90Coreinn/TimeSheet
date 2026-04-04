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
                .ThenInclude(e => e.Project)
            .Include(t => t.Entries)
                .ThenInclude(e => e.TaskCategory)
            .Include(t => t.ApprovalActions)
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Id == id, ct);

    public async Task<Timesheet?> GetByUserAndDateAsync(Guid userId, DateOnly workDate, CancellationToken ct = default)
        => await _dbSet
            .Include(t => t.Entries)
            .FirstOrDefaultAsync(t => t.UserId == userId && t.WorkDate == workDate, ct);

    public async Task<IReadOnlyList<Timesheet>> GetPendingForManagerAsync(Guid managerId, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Include(t => t.User)
            .Include(t => t.Entries)
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

    public void AddEntry(TimesheetEntry entry) => _context.Set<TimesheetEntry>().Add(entry);

    public void RemoveEntry(TimesheetEntry entry) => _context.Set<TimesheetEntry>().Remove(entry);

    public void AddApprovalAction(ApprovalAction action) => _context.Set<ApprovalAction>().Add(action);

    public async Task<IReadOnlyList<Timesheet>> GetByUserAndWeekTrackedAsync(
        Guid userId, DateOnly weekStart, DateOnly weekEnd, CancellationToken ct = default)
        => await _dbSet
            .Include(t => t.Entries)
            .Where(t => t.UserId == userId && t.WorkDate >= weekStart && t.WorkDate <= weekEnd)
            .OrderBy(t => t.WorkDate)
            .ToListAsync(ct);

    public async Task<(IReadOnlyList<PendingApprovalTimesheetRow> Items, int TotalCount, int Page)> GetPendingForManagersPageAsync(
        IReadOnlyCollection<Guid> managerIds,
        string? search,
        bool? hasMismatch,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        if (managerIds.Count == 0)
            return (Array.Empty<PendingApprovalTimesheetRow>(), 0, 1);

        var managerIdList = managerIds.Distinct().ToList();
        var query = _dbSet
            .AsNoTracking()
            .Where(t => t.Status == TimesheetStatus.Submitted
                && t.User.ManagerId.HasValue
                && managerIdList.Contains(t.User.ManagerId.Value));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(t =>
                t.User.Username.Contains(term) ||
                (t.User.DisplayName != null && t.User.DisplayName.Contains(term)) ||
                (t.MismatchReason != null && t.MismatchReason.Contains(term)));
        }

        if (hasMismatch.HasValue)
        {
            query = hasMismatch.Value
                ? query.Where(t => t.MismatchReason != null)
                : query.Where(t => t.MismatchReason == null);
        }

        sortBy = (sortBy ?? "workdate").Trim().ToLowerInvariant();
        query = sortBy switch
        {
            "username" => descending ? query.OrderByDescending(t => t.User.Username) : query.OrderBy(t => t.User.Username),
            "displayname" => descending ? query.OrderByDescending(t => t.User.DisplayName ?? t.User.Username) : query.OrderBy(t => t.User.DisplayName ?? t.User.Username),
            "enteredminutes" => descending
                ? query.OrderByDescending(t => t.Entries.Sum(e => e.Minutes))
                : query.OrderBy(t => t.Entries.Sum(e => e.Minutes)),
            "submittedatutc" => descending ? query.OrderByDescending(t => t.SubmittedAtUtc) : query.OrderBy(t => t.SubmittedAtUtc),
            _ => descending ? query.OrderByDescending(t => t.WorkDate) : query.OrderBy(t => t.WorkDate)
        };

        var totalCount = await query.CountAsync(ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        var safePage = page > totalPages ? totalPages : page;

        var rows = await query
            .Skip((safePage - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new PendingApprovalTimesheetDbRow(
                t.Id,
                t.UserId,
                t.User.ManagerId,
                t.User.Username,
                t.User.DisplayName ?? t.User.Username,
                t.WorkDate,
                t.Entries.Sum(e => e.Minutes),
                t.Status,
                t.SubmittedAtUtc,
                t.MismatchReason != null,
                t.MismatchReason))
            .ToListAsync(ct);

        return (rows.Select(MapPendingApproval).ToList(), totalCount, safePage);
    }

    private static PendingApprovalTimesheetRow MapPendingApproval(PendingApprovalTimesheetDbRow row)
        => new(
            row.Id,
            row.UserId,
            row.ManagerId,
            row.Username,
            row.DisplayName,
            row.WorkDate,
            row.EnteredMinutes,
            row.Status.ToString().ToLowerInvariant(),
            row.SubmittedAtUtc,
            row.HasMismatch,
            row.MismatchReason);

    private sealed record PendingApprovalTimesheetDbRow(
        Guid Id,
        Guid UserId,
        Guid? ManagerId,
        string Username,
        string DisplayName,
        DateOnly WorkDate,
        int EnteredMinutes,
        TimesheetStatus Status,
        DateTime? SubmittedAtUtc,
        bool HasMismatch,
        string? MismatchReason);
}

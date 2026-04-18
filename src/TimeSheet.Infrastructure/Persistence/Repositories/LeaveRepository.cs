using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class LeaveRepository(TimeSheetDbContext context)
    : BaseRepository<LeaveRequest>(context), ILeaveRepository
{
    public async Task<LeaveRequest?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet
            .Include(lr => lr.LeaveType)
            .FirstOrDefaultAsync(lr => lr.Id == id, ct);

    public async Task<IReadOnlyList<LeaveRequest>> GetByIdOrGroupIdAsync(Guid idOrGroupId, CancellationToken ct = default)
        => await _dbSet
            .Include(lr => lr.LeaveType)
            .Where(lr => lr.Id == idOrGroupId || lr.LeaveGroupId == idOrGroupId)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<LeaveRequest>> GetPendingForManagerAsync(Guid managerId, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Include(lr => lr.User)
            .Include(lr => lr.LeaveType)
            .Where(lr => lr.Status == LeaveRequestStatus.Pending && lr.User.ManagerId == managerId)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<LeaveRequest>> GetByUserAsync(Guid userId, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Include(lr => lr.LeaveType)
            .Where(lr => lr.UserId == userId)
            .OrderByDescending(lr => lr.LeaveDate)
            .ToListAsync(ct);

    public async Task<LeaveBalance?> GetBalanceAsync(
        Guid userId, Guid leaveTypeId, int year, CancellationToken ct = default)
        => await _context.LeaveBalances
            .FirstOrDefaultAsync(
                lb => lb.UserId == userId && lb.LeaveTypeId == leaveTypeId && lb.Year == year, ct);

    public void Add(LeaveRequest leaveRequest) => _dbSet.Add(leaveRequest);

    public void AddRange(IEnumerable<LeaveRequest> leaveRequests) => _dbSet.AddRange(leaveRequests);

    public void RemoveRange(IEnumerable<LeaveRequest> leaveRequests) => _dbSet.RemoveRange(leaveRequests);

    public async Task<IReadOnlyList<DateOnly>> GetActiveDatesAsync(
        Guid userId, IReadOnlyList<DateOnly> dates, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Where(lr => lr.UserId == userId
                && lr.Status != LeaveRequestStatus.Rejected
                && dates.Contains(lr.LeaveDate))
            .Select(lr => lr.LeaveDate)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<LeaveRequest>> GetRejectedForDatesAsync(
        Guid userId, IReadOnlyList<DateOnly> dates, CancellationToken ct = default)
        => await _dbSet
            .Where(lr => lr.UserId == userId
                && lr.Status == LeaveRequestStatus.Rejected
                && dates.Contains(lr.LeaveDate))
            .ToListAsync(ct);

    public void AddBalance(LeaveBalance balance) => _context.LeaveBalances.Add(balance);

    public async Task<(IReadOnlyList<PagedLeaveRequestRow> Items, int TotalCount, int Page)> GetUserRequestsPageAsync(
        Guid userId,
        string? search,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _dbSet.AsNoTracking().Where(x => x.UserId == userId);
        return await GetLeaveRequestsPageInternalAsync(query, search, sortBy, descending, page, pageSize, ct);
    }

    public async Task<(IReadOnlyList<PagedLeaveRequestRow> Items, int TotalCount, int Page)> GetPendingForManagerPageAsync(
        Guid managerId,
        bool isAdmin,
        string? search,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _dbSet
            .AsNoTracking()
            .Where(x => x.Status == LeaveRequestStatus.Pending);

        if (!isAdmin)
            query = query.Where(x => x.User.ManagerId == managerId);

        return await GetLeaveRequestsPageInternalAsync(query, search, sortBy, descending, page, pageSize, ct);
    }

    public async Task<IReadOnlyList<LeaveCalendarRow>> GetCalendarAsync(Guid userId, int year, int month, CancellationToken ct = default)
    {
        var leaveRequests = await _dbSet
            .AsNoTracking()
            .Where(lr => lr.UserId == userId && lr.LeaveDate.Year == year && lr.LeaveDate.Month == month)
            .Select(lr => new { lr.LeaveDate, lr.Status })
            .ToListAsync(ct);

        return leaveRequests.Select(r => new LeaveCalendarRow(
            r.LeaveDate,
            r.Status == LeaveRequestStatus.Approved ? "approved"
                : r.Status == LeaveRequestStatus.Rejected ? "rejected"
                : "pending"))
            .ToList();
    }

    public async Task<IReadOnlyList<TeamLeaveCalendarRow>> GetTeamCalendarAsync(Guid userId, string role, int year, int month, CancellationToken ct = default)
    {
        var teamUserIds = await ResolveTeamUserIdsAsync(userId, role, includeCurrentUser: true, ct);
        if (teamUserIds.Count == 0)
            return Array.Empty<TeamLeaveCalendarRow>();

        var requests = await _dbSet
            .AsNoTracking()
            .Include(lr => lr.User)
            .Include(lr => lr.LeaveType)
            .Where(lr => teamUserIds.Contains(lr.UserId)
                && lr.LeaveDate.Year == year
                && lr.LeaveDate.Month == month
                && lr.Status != LeaveRequestStatus.Rejected)
            .OrderBy(lr => lr.LeaveDate)
            .ToListAsync(ct);

        return requests
            .GroupBy(lr => lr.LeaveDate)
            .Select(g => new TeamLeaveCalendarRow(
                g.Key,
                g.Select(lr => new TeamLeaveEntryRow(
                    lr.UserId,
                    lr.User.Username,
                    lr.User.DisplayName,
                    lr.LeaveType.Name,
                    lr.Status.ToString().ToLowerInvariant())).ToList()))
            .OrderBy(x => x.Date)
            .ToList();
    }

    public async Task<LeaveConflictRow> GetConflictsAsync(Guid currentUserId, string role, DateOnly fromDate, DateOnly toDate, Guid? targetUserId, CancellationToken ct = default)
    {
        var effectiveTargetUserId = targetUserId ?? currentUserId;
        var teamUserIds = await ResolveTeamUserIdsAsync(currentUserId, role, includeCurrentUser: true, ct);
        if (teamUserIds.Count == 0)
            return new LeaveConflictRow(0, Array.Empty<string>());

        teamUserIds = teamUserIds.Where(id => id != effectiveTargetUserId).ToList();
        if (teamUserIds.Count == 0)
            return new LeaveConflictRow(0, Array.Empty<string>());

        var conflictingUsers = await _dbSet
            .AsNoTracking()
            .Include(lr => lr.User)
            .Where(lr => teamUserIds.Contains(lr.UserId)
                && lr.LeaveDate >= fromDate
                && lr.LeaveDate <= toDate
                && lr.Status != LeaveRequestStatus.Rejected)
            .Select(lr => new { lr.UserId, lr.User.Username })
            .Distinct()
            .ToListAsync(ct);

        var usernames = conflictingUsers
            .GroupBy(x => x.UserId)
            .Select(g => g.First().Username)
            .ToList();

        return new LeaveConflictRow(usernames.Count, usernames.Take(5).ToList());
    }

    public async Task<IReadOnlyList<TeamOnLeaveRow>> GetTeamOnLeaveAsync(Guid userId, DateOnly today, DateOnly windowEnd, CancellationToken ct = default)
    {
        var currentUser = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (currentUser is null)
            return Array.Empty<TeamOnLeaveRow>();

        var teamUserIds = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id != userId && u.IsActive && (u.ManagerId == currentUser.ManagerId || u.ManagerId == userId))
            .Select(u => u.Id)
            .ToListAsync(ct);
        if (teamUserIds.Count == 0)
            return Array.Empty<TeamOnLeaveRow>();

        var teamRequests = await _dbSet
            .AsNoTracking()
            .Include(lr => lr.User)
            .Include(lr => lr.LeaveType)
            .Where(lr => teamUserIds.Contains(lr.UserId)
                && lr.LeaveDate >= today
                && lr.LeaveDate <= windowEnd
                && lr.Status != LeaveRequestStatus.Rejected)
            .OrderBy(lr => lr.LeaveDate)
            .ToListAsync(ct);

        return teamRequests
            .GroupBy(lr => new { lr.UserId, GroupKey = lr.LeaveGroupId ?? lr.Id, LeaveTypeName = lr.LeaveType.Name })
            .Select(g =>
            {
                var first = g.First();
                var fromDate = g.Min(r => r.LeaveDate);
                return new TeamOnLeaveRow(
                    first.UserId,
                    first.User.Username,
                    fromDate,
                    g.Max(r => r.LeaveDate),
                    first.LeaveType.Name,
                    fromDate <= today ? "away" : "upcoming");
            })
            .ToList();
    }

    private static IQueryable<LeaveRequest> ApplySort(IQueryable<LeaveRequest> query, string sortBy, bool descending)
    {
        return sortBy switch
        {
            "username" => descending ? query.OrderByDescending(x => x.User.Username) : query.OrderBy(x => x.User.Username),
            "leavetypename" => descending ? query.OrderByDescending(x => x.LeaveType.Name) : query.OrderBy(x => x.LeaveType.Name),
            "status" => descending ? query.OrderByDescending(x => x.Status) : query.OrderBy(x => x.Status),
            "createdatutc" => descending ? query.OrderByDescending(x => x.CreatedAtUtc) : query.OrderBy(x => x.CreatedAtUtc),
            _ => descending ? query.OrderByDescending(x => x.LeaveDate) : query.OrderBy(x => x.LeaveDate),
        };
    }

    private static async Task<(IReadOnlyList<PagedLeaveRequestRow> Items, int TotalCount, int Page)> GetLeaveRequestsPageInternalAsync(
        IQueryable<LeaveRequest> baseQuery,
        string? search,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            baseQuery = baseQuery.Where(x =>
                EF.Functions.Like(x.User.Username, term) ||
                EF.Functions.Like(x.LeaveType.Name, term) ||
                (x.Comment != null && EF.Functions.Like(x.Comment, term)));
        }

        var query = ApplySort(baseQuery, sortBy, descending);

        var totalCount = await query.CountAsync(ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        var safePage = page > totalPages ? totalPages : page;

        var items = await query
            .Skip((safePage - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new LeaveRequestPageDbRow(
                x.Id,
                x.UserId,
                x.User.Username,
                x.LeaveDate,
                x.LeaveTypeId,
                x.LeaveType.Name,
                x.IsHalfDay,
                x.Status,
                x.Comment,
                x.ReviewedByUserId,
                x.ReviewedByUser != null ? x.ReviewedByUser.Username : null,
                x.ReviewerComment,
                x.CreatedAtUtc,
                x.ReviewedAtUtc))
            .ToListAsync(ct);

        return (items.Select(MapPagedLeaveRequestRow).ToList(), totalCount, safePage);
    }

    private static PagedLeaveRequestRow MapPagedLeaveRequestRow(LeaveRequestPageDbRow row)
        => new(
            row.Id,
            row.UserId,
            row.Username,
            row.LeaveDate,
            row.LeaveTypeId,
            row.LeaveTypeName,
            row.IsHalfDay,
            row.Status.ToString().ToLowerInvariant(),
            row.Comment,
            row.ReviewedByUserId,
            row.ReviewedByUsername,
            row.ReviewerComment,
            row.CreatedAtUtc,
            row.ReviewedAtUtc);

    private async Task<List<Guid>> ResolveTeamUserIdsAsync(Guid userId, string role, bool includeCurrentUser, CancellationToken ct)
    {
        var normalizedRole = (role ?? "employee").Trim().ToLowerInvariant();
        if (normalizedRole is "manager" or "admin")
        {
            return await _context.Users
                .AsNoTracking()
                .Where(u => u.IsActive && (u.ManagerId == userId || (includeCurrentUser && u.Id == userId)))
                .Select(u => u.Id)
                .ToListAsync(ct);
        }

        var currentUser = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (currentUser?.DepartmentId is null)
            return new List<Guid>();

        return await _context.Users
            .AsNoTracking()
            .Where(u => u.IsActive && u.DepartmentId == currentUser.DepartmentId)
            .Select(u => u.Id)
            .ToListAsync(ct);
    }

    private sealed record LeaveRequestPageDbRow(
        Guid Id,
        Guid UserId,
        string Username,
        DateOnly LeaveDate,
        Guid LeaveTypeId,
        string LeaveTypeName,
        bool IsHalfDay,
        LeaveRequestStatus Status,
        string? Comment,
        Guid? ReviewedByUserId,
        string? ReviewedByUsername,
        string? ReviewerComment,
        DateTime CreatedAtUtc,
        DateTime? ReviewedAtUtc);
}

using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class ManagerRepository(TimeSheetDbContext context) : IManagerRepository
{
    public async Task<(IReadOnlyList<TeamMemberStatusRow> Items, int TotalCount, int Page)> GetTeamStatusPageAsync(
        Guid managerId,
        DateOnly date,
        string? search,
        string? attendance,
        string? timesheetStatus,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var weekStart = StartOfWeek(date);
        var weekEnd = weekStart.AddDays(6);

        var directReports = await context.Users
            .AsNoTracking()
            .Where(u => u.ManagerId == managerId && u.IsActive)
            .Select(u => new
            {
                u.Id,
                u.Username,
                u.DisplayName,
                u.AvatarDataUrl,
                u.WorkPolicyId
            })
            .ToListAsync(ct);

        if (directReports.Count == 0)
            return (Array.Empty<TeamMemberStatusRow>(), 0, 1);

        var reportIds = directReports.Select(u => u.Id).ToList();

        var sessions = await context.WorkSessions
            .AsNoTracking()
            .Where(ws => reportIds.Contains(ws.UserId) && ws.WorkDate == date)
            .ToListAsync(ct);

        var weekTimesheets = await context.Timesheets
            .AsNoTracking()
            .Where(t => reportIds.Contains(t.UserId) && t.WorkDate >= weekStart && t.WorkDate <= weekEnd)
            .Select(t => new
            {
                t.UserId,
                t.WorkDate,
                t.Status,
                EntriesMinutes = t.Entries.Sum(e => e.Minutes)
            })
            .ToListAsync(ct);

        var onLeaveUserIds = (await context.LeaveRequests
            .AsNoTracking()
            .Where(l => reportIds.Contains(l.UserId) && l.LeaveDate == date && l.Status == LeaveRequestStatus.Approved)
            .Select(l => l.UserId)
            .ToListAsync(ct)).ToHashSet();

        var pendingByUser = (await context.Timesheets
            .AsNoTracking()
            .Where(t => reportIds.Contains(t.UserId) && t.Status == TimesheetStatus.Submitted)
            .GroupBy(t => t.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToListAsync(ct)).ToDictionary(x => x.UserId, x => x.Count);

        var workPolicies = (await context.WorkPolicies
            .AsNoTracking()
            .Select(wp => new { wp.Id, wp.DailyExpectedMinutes, wp.WorkDaysPerWeek })
            .ToListAsync(ct)).ToDictionary(wp => wp.Id);

        var query = directReports.Select(u =>
        {
            var todaySessions = sessions.Where(ws => ws.UserId == u.Id).ToList();
            var activeSession = todaySessions.FirstOrDefault(ws => ws.Status == WorkSessionStatus.Active);
            var completedSession = todaySessions
                .OrderByDescending(ws => ws.CheckOutAtUtc)
                .FirstOrDefault(ws => ws.Status == WorkSessionStatus.Completed);

            string resolvedAttendance;
            string? checkInAtUtc = null;
            string? checkOutAtUtc = null;

            if (onLeaveUserIds.Contains(u.Id))
            {
                resolvedAttendance = "onLeave";
            }
            else if (activeSession is not null)
            {
                resolvedAttendance = "checkedIn";
                checkInAtUtc = DateTime.SpecifyKind(activeSession.CheckInAtUtc, DateTimeKind.Utc).ToString("O");
            }
            else if (completedSession is not null)
            {
                resolvedAttendance = "checkedOut";
                checkInAtUtc = DateTime.SpecifyKind(completedSession.CheckInAtUtc, DateTimeKind.Utc).ToString("O");
                checkOutAtUtc = completedSession.CheckOutAtUtc.HasValue
                    ? DateTime.SpecifyKind(completedSession.CheckOutAtUtc.Value, DateTimeKind.Utc).ToString("O")
                    : null;
            }
            else
            {
                resolvedAttendance = "absent";
            }

            var userWeekTimesheets = weekTimesheets.Where(t => t.UserId == u.Id).ToList();
            var weekLogged = userWeekTimesheets.Sum(t => t.EntriesMinutes);

            var dailyExpected = 480;
            var workDaysPerWeek = 5;
            if (u.WorkPolicyId.HasValue && workPolicies.TryGetValue(u.WorkPolicyId.Value, out var policy))
            {
                dailyExpected = policy.DailyExpectedMinutes;
                workDaysPerWeek = policy.WorkDaysPerWeek > 0 ? policy.WorkDaysPerWeek : 5;
            }

            var todayTimesheet = userWeekTimesheets.FirstOrDefault(t => t.WorkDate == date);
            var resolvedTimesheetStatus = todayTimesheet is null || todayTimesheet.EntriesMinutes == 0
                ? "missing"
                : todayTimesheet.Status.ToString().ToLowerInvariant();

            return new TeamMemberStatusRow(
                u.Id,
                u.Username,
                u.DisplayName,
                u.AvatarDataUrl,
                resolvedAttendance,
                checkInAtUtc,
                checkOutAtUtc,
                weekLogged,
                dailyExpected * workDaysPerWeek,
                resolvedTimesheetStatus,
                pendingByUser.GetValueOrDefault(u.Id, 0));
        }).AsEnumerable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(r =>
                r.Username.ToLower().Contains(term) ||
                r.DisplayName.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(attendance))
        {
            var normalizedAttendance = attendance.Trim().ToLowerInvariant();
            query = query.Where(r => r.Attendance.ToLowerInvariant() == normalizedAttendance);
        }

        if (!string.IsNullOrWhiteSpace(timesheetStatus))
        {
            var normalizedStatus = timesheetStatus.Trim().ToLowerInvariant();
            query = query.Where(r => r.TodayTimesheetStatus.ToLowerInvariant() == normalizedStatus);
        }

        sortBy = (sortBy ?? "username").Trim().ToLowerInvariant();
        query = sortBy switch
        {
            "displayname" => descending ? query.OrderByDescending(r => r.DisplayName) : query.OrderBy(r => r.DisplayName),
            "attendance" => descending ? query.OrderByDescending(r => r.Attendance) : query.OrderBy(r => r.Attendance),
            "weekloggedminutes" => descending ? query.OrderByDescending(r => r.WeekLoggedMinutes) : query.OrderBy(r => r.WeekLoggedMinutes),
            "pendingapprovalcount" => descending ? query.OrderByDescending(r => r.PendingApprovalCount) : query.OrderBy(r => r.PendingApprovalCount),
            _ => descending ? query.OrderByDescending(r => r.Username) : query.OrderBy(r => r.Username),
        };

        var totalCount = query.Count();
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        var safePage = page > totalPages ? totalPages : page;
        var items = query.Skip((safePage - 1) * pageSize).Take(pageSize).ToList();

        return (items, totalCount, safePage);
    }

    public async Task<bool> IsDirectReportAsync(Guid managerId, Guid userId, CancellationToken ct = default)
        => await context.Users
            .AsNoTracking()
            .AnyAsync(u => u.Id == userId && u.ManagerId == managerId && u.IsActive, ct);

    private static DateOnly StartOfWeek(DateOnly date)
    {
        var diff = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-diff);
    }
}

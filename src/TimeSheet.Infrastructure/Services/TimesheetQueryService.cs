using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Infrastructure.Persistence;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class TimesheetQueryService : AppInterfaces.ITimesheetQueryService
{
    private readonly TimeSheetDbContext _context;
    private readonly IAttendanceCalculationService _attendanceCalc;

    public TimesheetQueryService(TimeSheetDbContext context, IAttendanceCalculationService attendanceCalc)
    {
        _context = context;
        _attendanceCalc = attendanceCalc;
    }

    public async Task<AppInterfaces.TimesheetDayResult?> GetDayAsync(Guid userId, DateOnly date, CancellationToken ct = default)
    {
        var timesheet = await _context.Timesheets
            .AsNoTracking()
            .Include(t => t.Entries).ThenInclude(e => e.Project)
            .Include(t => t.Entries).ThenInclude(e => e.TaskCategory)
            .SingleOrDefaultAsync(t => t.UserId == userId && t.WorkDate == date, ct);

        var attendanceNet = await GetAttendanceNetMinutesAsync(userId, date, ct);
        var expected = await GetExpectedMinutesAsync(userId, date, ct);

        var entered = timesheet?.Entries.Sum(e => e.Minutes) ?? 0;
        var remaining = Math.Max(0, expected - entered);
        var hasMismatch = attendanceNet != entered;

        var status = (timesheet?.Status ?? TimesheetStatus.Draft).ToString().ToLowerInvariant();
        var mismatchReason = timesheet?.MismatchReason;

        var entries = (timesheet?.Entries ?? Enumerable.Empty<TimesheetEntry>())
            .OrderBy(e => e.Project.Name)
            .ThenBy(e => e.TaskCategory.Name)
            .Select(e => new AppInterfaces.TimesheetEntryResult(
                e.Id,
                e.ProjectId,
                e.Project.Name,
                e.TaskCategoryId,
                e.TaskCategory.Name,
                e.Minutes,
                e.Notes))
            .ToList();

        return new AppInterfaces.TimesheetDayResult(
            timesheet?.Id ?? Guid.Empty,
            date,
            status,
            attendanceNet,
            expected,
            entered,
            remaining,
            hasMismatch,
            mismatchReason,
            timesheet?.ManagerComment,
            entries);
    }

    public async Task<AppInterfaces.TimesheetWeekResult> GetWeekAsync(Guid userId, DateOnly anyDateInWeek, CancellationToken ct = default)
    {
        var diff = ((int)anyDateInWeek.DayOfWeek + 6) % 7;
        var weekStart = anyDateInWeek.AddDays(-diff);
        var weekEnd = weekStart.AddDays(6);

        // Batch load all data for the week
        var timesheets = await _context.Timesheets
            .AsNoTracking()
            .Include(t => t.Entries)
            .Where(t => t.UserId == userId && t.WorkDate >= weekStart && t.WorkDate <= weekEnd)
            .ToListAsync(ct);

        var workSessions = await _context.WorkSessions
            .AsNoTracking()
            .Include(ws => ws.Breaks)
            .Where(ws => ws.UserId == userId && ws.WorkDate >= weekStart && ws.WorkDate <= weekEnd)
            .ToListAsync(ct);

        var leaveRequests = await _context.LeaveRequests
            .AsNoTracking()
            .Where(lr => lr.UserId == userId
                && lr.LeaveDate >= weekStart
                && lr.LeaveDate <= weekEnd
                && lr.Status == LeaveRequestStatus.Approved)
            .ToListAsync(ct);

        var holidayDates = await _context.Holidays
            .AsNoTracking()
            .Where(h => h.Date >= weekStart && h.Date <= weekEnd)
            .Select(h => h.Date)
            .ToListAsync(ct);

        var policy = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.WorkPolicy)
            .SingleOrDefaultAsync(ct);

        var days = new List<AppInterfaces.TimesheetWeekDayResult>();

        for (var i = 0; i < 7; i++)
        {
            var day = weekStart.AddDays(i);

            var daySessions = workSessions.Where(ws => ws.WorkDate == day).ToList();
            var attendanceNet = daySessions.Count > 0
                ? _attendanceCalc.Calculate(daySessions, policy, DateTime.UtcNow).NetMinutes
                : 0;

            int expectedMinutes;
            if (day.DayOfWeek == DayOfWeek.Sunday)
            {
                expectedMinutes = 0;
            }
            else if (holidayDates.Contains(day))
            {
                expectedMinutes = 0;
            }
            else
            {
                var approvedLeave = leaveRequests.FirstOrDefault(lr => lr.LeaveDate == day);
                if (approvedLeave != null)
                {
                    var baseExpected = policy?.DailyExpectedMinutes ?? 480;
                    expectedMinutes = approvedLeave.IsHalfDay ? baseExpected / 2 : 0;
                }
                else
                {
                    expectedMinutes = policy?.DailyExpectedMinutes ?? 480;
                }
            }

            var timesheet = timesheets.FirstOrDefault(t => t.WorkDate == day);
            var status = (timesheet?.Status ?? TimesheetStatus.Draft).ToString().ToLowerInvariant();
            var entered = timesheet?.Entries.Sum(e => e.Minutes) ?? 0;
            var hasMismatch = attendanceNet != entered;

            days.Add(new AppInterfaces.TimesheetWeekDayResult(
                day,
                status,
                entered,
                attendanceNet,
                expectedMinutes,
                hasMismatch));
        }

        return new AppInterfaces.TimesheetWeekResult(
            weekStart,
            weekEnd,
            days.Sum(d => d.EnteredMinutes),
            days.Sum(d => d.AttendanceNetMinutes),
            days.Sum(d => d.ExpectedMinutes),
            days);
    }

    public async Task<AppInterfaces.EntryOptionsResult> GetEntryOptionsAsync(CancellationToken ct = default)
    {
        var projects = await _context.Projects
            .AsNoTracking()
            .Where(p => p.IsActive && !p.IsArchived)
            .OrderBy(p => p.Name)
            .Select(p => new AppInterfaces.ProjectResult(p.Id, p.Name, p.Code, p.IsActive, p.IsArchived, p.BudgetedHours))
            .ToListAsync(ct);

        var taskCategories = await _context.TaskCategories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new AppInterfaces.TaskCategoryResult(c.Id, c.Name, c.IsActive, c.IsBillable))
            .ToListAsync(ct);

        return new AppInterfaces.EntryOptionsResult(projects, taskCategories);
    }

    public async Task<int> GetBackdateWindowDaysAsync(Guid userId, CancellationToken ct = default)
    {
        return await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.WorkPolicy != null ? u.WorkPolicy.TimesheetBackdateWindowDays : 7)
            .SingleOrDefaultAsync(ct);
    }

    public async Task<bool> RequiresMismatchReasonAsync(Guid userId, CancellationToken ct = default)
    {
        return await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.WorkPolicy != null && u.WorkPolicy.RequireMismatchReason)
            .SingleOrDefaultAsync(ct);
    }

    public async Task<bool> IsActiveProjectAsync(Guid projectId, CancellationToken ct = default)
    {
        return await _context.Projects
            .AsNoTracking()
            .AnyAsync(p => p.Id == projectId && p.IsActive && !p.IsArchived, ct);
    }

    public async Task<bool> IsActiveTaskCategoryAsync(Guid categoryId, CancellationToken ct = default)
    {
        return await _context.TaskCategories
            .AsNoTracking()
            .AnyAsync(c => c.Id == categoryId && c.IsActive, ct);
    }

    public async Task<int> GetAttendanceNetMinutesAsync(Guid userId, DateOnly date, CancellationToken ct = default)
    {
        var sessions = await _context.WorkSessions
            .AsNoTracking()
            .Include(ws => ws.Breaks)
            .Where(ws => ws.UserId == userId && ws.WorkDate == date)
            .ToListAsync(ct);

        if (sessions.Count == 0)
            return 0;

        var policy = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.WorkPolicy)
            .SingleOrDefaultAsync(ct);

        return _attendanceCalc.Calculate(sessions, policy, DateTime.UtcNow).NetMinutes;
    }

    public async Task<int> GetExpectedMinutesAsync(Guid userId, DateOnly date, CancellationToken ct = default)
    {
        var expected = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.WorkPolicy != null ? u.WorkPolicy.DailyExpectedMinutes : 480)
            .SingleOrDefaultAsync(ct);

        if (date.DayOfWeek == DayOfWeek.Sunday)
            return 0;

        var isHoliday = await _context.Holidays
            .AsNoTracking()
            .AnyAsync(h => h.Date == date, ct);

        if (isHoliday)
            return 0;

        var leave = await _context.LeaveRequests
            .AsNoTracking()
            .SingleOrDefaultAsync(lr => lr.UserId == userId
                && lr.LeaveDate == date
                && lr.Status == LeaveRequestStatus.Approved, ct);

        if (leave != null)
            return leave.IsHalfDay ? expected / 2 : 0;

        return expected;
    }

    public async Task<DateOnly?> GetWorkDateByEntryIdAsync(Guid entryId, Guid userId, CancellationToken ct = default)
        => await _context.TimesheetEntries
            .AsNoTracking()
            .Where(e => e.Id == entryId && e.Timesheet.UserId == userId)
            .Select(e => (DateOnly?)e.Timesheet.WorkDate)
            .SingleOrDefaultAsync(ct);

    public async Task<bool?> IsActiveUserAsync(Guid userId, CancellationToken ct = default)
        => await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (bool?)u.IsActive)
            .SingleOrDefaultAsync(ct);
}

using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class TimesheetReadRepository(TimeSheetDbContext context) : ITimesheetReadRepository
{
    public async Task<TimesheetDayRow?> GetDayAsync(Guid userId, DateOnly date, CancellationToken ct = default)
    {
        var timesheet = await context.Timesheets
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.WorkDate == date)
            .Select(t => new TimesheetDayDbRow(
                t.Id,
                t.Status,
                t.Entries.Sum(e => e.Minutes),
                t.MismatchReason,
                t.ManagerComment,
                t.Entries
                    .OrderBy(e => e.Project.Name)
                    .ThenBy(e => e.TaskCategory.Name)
                    .Select(e => new TimesheetEntryReadRow(
                        e.Id,
                        e.ProjectId,
                        e.Project.Name,
                        e.TaskCategoryId,
                        e.TaskCategory.Name,
                        e.Minutes,
                        e.Notes))
                    .ToList()))
            .SingleOrDefaultAsync(ct);

        return timesheet is null ? null : new TimesheetDayRow(
            timesheet.Id,
            timesheet.Status.ToString().ToLowerInvariant(),
            timesheet.TotalMinutes,
            timesheet.MismatchReason,
            timesheet.ManagerComment,
            timesheet.Entries);
    }

    public async Task<TimesheetWeekBundleRow> GetWeekBundleAsync(Guid userId, DateOnly weekStart, DateOnly weekEnd, CancellationToken ct = default)
    {
        var timesheets = await context.Timesheets
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.WorkDate >= weekStart && t.WorkDate <= weekEnd)
            .Select(t => new TimesheetWeekDayDbRow(
                t.WorkDate,
                t.Status,
                t.Entries.Sum(e => e.Minutes)))
            .ToListAsync(ct);

        var sessions = await context.WorkSessions
            .AsNoTracking()
            .Where(ws => ws.UserId == userId && ws.WorkDate >= weekStart && ws.WorkDate <= weekEnd)
            .Select(ws => new WorkSessionDbRow(
                ws.Id,
                ws.WorkDate,
                ws.CheckInAtUtc,
                ws.CheckOutAtUtc,
                ws.Status,
                ws.Breaks.Select(b => new WorkSessionBreakReadRow(
                    b.Id,
                    b.StartAtUtc,
                    b.EndAtUtc,
                    b.DurationMinutes,
                    b.IsManualEdit,
                    b.EndAtUtc == null)).ToList()))
            .ToListAsync(ct);

        var approvedLeaves = await context.LeaveRequests
            .AsNoTracking()
            .Where(lr => lr.UserId == userId && lr.LeaveDate >= weekStart && lr.LeaveDate <= weekEnd && lr.Status == LeaveRequestStatus.Approved)
            .Select(lr => new ApprovedLeaveDayRow(lr.LeaveDate, lr.IsHalfDay))
            .ToListAsync(ct);

        var holidays = await context.Holidays
            .AsNoTracking()
            .Where(h => h.Date >= weekStart && h.Date <= weekEnd)
            .Select(h => h.Date)
            .ToListAsync(ct);

        var policy = await context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId && u.WorkPolicy != null)
            .Select(u => new WorkPolicyReadRow(
                u.WorkPolicy!.Id,
                u.WorkPolicy.DailyExpectedMinutes,
                u.WorkPolicy.WorkDaysPerWeek,
                u.WorkPolicy.TimesheetBackdateWindowDays,
                u.WorkPolicy.RequireMismatchReason))
            .SingleOrDefaultAsync(ct);

        return new TimesheetWeekBundleRow(
            timesheets.Select(x => new TimesheetWeekDayReadRow(x.WorkDate, x.Status.ToString().ToLowerInvariant(), x.TotalMinutes)).ToList(),
            sessions.Select(MapSession).ToList(),
            approvedLeaves,
            holidays,
            policy);
    }

    public async Task<EntryOptionsRow> GetEntryOptionsAsync(CancellationToken ct = default)
    {
        var projects = await context.Projects
            .AsNoTracking()
            .Where(p => p.IsActive && !p.IsArchived)
            .OrderBy(p => p.Name)
            .Select(p => new ProjectOptionRow(p.Id, p.Name, p.Code, p.IsActive, p.IsArchived, p.BudgetedHours))
            .ToListAsync(ct);

        var taskCategories = await context.TaskCategories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new TaskCategoryOptionRow(c.Id, c.Name, c.IsActive, c.IsBillable))
            .ToListAsync(ct);

        return new EntryOptionsRow(projects, taskCategories);
    }

    public async Task<int> GetBackdateWindowDaysAsync(Guid userId, CancellationToken ct = default)
        => await context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.WorkPolicy != null ? u.WorkPolicy.TimesheetBackdateWindowDays : 7)
            .SingleOrDefaultAsync(ct);

    public async Task<bool> RequiresMismatchReasonAsync(Guid userId, CancellationToken ct = default)
        => await context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.WorkPolicy != null && u.WorkPolicy.RequireMismatchReason)
            .SingleOrDefaultAsync(ct);

    public async Task<bool> IsActiveProjectAsync(Guid projectId, CancellationToken ct = default)
        => await context.Projects.AsNoTracking().AnyAsync(p => p.Id == projectId && p.IsActive && !p.IsArchived, ct);

    public async Task<bool> IsActiveTaskCategoryAsync(Guid categoryId, CancellationToken ct = default)
        => await context.TaskCategories.AsNoTracking().AnyAsync(c => c.Id == categoryId && c.IsActive, ct);

    public async Task<AttendanceDayBundleRow> GetAttendanceDayAsync(Guid userId, DateOnly date, CancellationToken ct = default)
    {
        var sessions = await context.WorkSessions
            .AsNoTracking()
            .Where(ws => ws.UserId == userId && ws.WorkDate == date)
            .Select(ws => new WorkSessionDbRow(
                ws.Id,
                ws.WorkDate,
                ws.CheckInAtUtc,
                ws.CheckOutAtUtc,
                ws.Status,
                ws.Breaks.Select(b => new WorkSessionBreakReadRow(
                    b.Id,
                    b.StartAtUtc,
                    b.EndAtUtc,
                    b.DurationMinutes,
                    b.IsManualEdit,
                    b.EndAtUtc == null)).ToList()))
            .ToListAsync(ct);

        var policy = await context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId && u.WorkPolicy != null)
            .Select(u => new WorkPolicyReadRow(
                u.WorkPolicy!.Id,
                u.WorkPolicy.DailyExpectedMinutes,
                u.WorkPolicy.WorkDaysPerWeek,
                u.WorkPolicy.TimesheetBackdateWindowDays,
                u.WorkPolicy.RequireMismatchReason))
            .SingleOrDefaultAsync(ct);

        return new AttendanceDayBundleRow(sessions.Select(MapSession).ToList(), policy);
    }

    public async Task<int> GetExpectedMinutesBaseAsync(Guid userId, CancellationToken ct = default)
        => await context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.WorkPolicy != null ? u.WorkPolicy.DailyExpectedMinutes : 480)
            .SingleOrDefaultAsync(ct);

    public async Task<bool> IsHolidayAsync(DateOnly date, CancellationToken ct = default)
        => await context.Holidays.AsNoTracking().AnyAsync(h => h.Date == date, ct);

    public async Task<ApprovedLeaveDayRow?> GetApprovedLeaveAsync(Guid userId, DateOnly date, CancellationToken ct = default)
        => await context.LeaveRequests
            .AsNoTracking()
            .Where(lr => lr.UserId == userId && lr.LeaveDate == date && lr.Status == LeaveRequestStatus.Approved)
            .Select(lr => new ApprovedLeaveDayRow(lr.LeaveDate, lr.IsHalfDay))
            .SingleOrDefaultAsync(ct);

    public async Task<DateOnly?> GetWorkDateByEntryIdAsync(Guid entryId, Guid userId, CancellationToken ct = default)
        => await context.TimesheetEntries
            .AsNoTracking()
            .Where(e => e.Id == entryId && e.Timesheet.UserId == userId)
            .Select(e => (DateOnly?)e.Timesheet.WorkDate)
            .SingleOrDefaultAsync(ct);

    public async Task<bool?> IsActiveUserAsync(Guid userId, CancellationToken ct = default)
        => await context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (bool?)u.IsActive)
            .SingleOrDefaultAsync(ct);

    private static WorkSessionReadRow MapSession(WorkSessionDbRow row)
        => new(
            row.Id,
            row.WorkDate,
            row.CheckInAtUtc,
            row.CheckOutAtUtc,
            row.Status.ToString().ToLowerInvariant(),
            row.Breaks);

    private sealed record TimesheetDayDbRow(
        Guid Id,
        TimesheetStatus Status,
        int TotalMinutes,
        string? MismatchReason,
        string? ManagerComment,
        List<TimesheetEntryReadRow> Entries);

    private sealed record TimesheetWeekDayDbRow(DateOnly WorkDate, TimesheetStatus Status, int TotalMinutes);

    private sealed record WorkSessionDbRow(
        Guid Id,
        DateOnly WorkDate,
        DateTime CheckInAtUtc,
        DateTime? CheckOutAtUtc,
        WorkSessionStatus Status,
        List<WorkSessionBreakReadRow> Breaks);
}

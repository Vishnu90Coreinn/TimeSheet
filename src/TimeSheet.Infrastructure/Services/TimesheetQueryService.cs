using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class TimesheetQueryService(ITimesheetReadRepository timesheetReadRepository, IAttendanceCalculationService attendanceCalc)
    : AppInterfaces.ITimesheetQueryService
{
    public async Task<AppInterfaces.TimesheetDayResult?> GetDayAsync(Guid userId, DateOnly date, CancellationToken ct = default)
    {
        var timesheet = await timesheetReadRepository.GetDayAsync(userId, date, ct);
        var attendanceNet = await GetAttendanceNetMinutesAsync(userId, date, ct);
        var expected = await GetExpectedMinutesAsync(userId, date, ct);

        var entered = timesheet?.EnteredMinutes ?? 0;
        var remaining = Math.Max(0, expected - entered);
        var hasMismatch = attendanceNet != entered;

        return new AppInterfaces.TimesheetDayResult(
            timesheet?.TimesheetId ?? Guid.Empty,
            date,
            timesheet?.Status ?? TimesheetStatus.Draft.ToString().ToLowerInvariant(),
            attendanceNet,
            expected,
            entered,
            remaining,
            hasMismatch,
            timesheet?.MismatchReason,
            timesheet?.ManagerComment,
            (timesheet?.Entries ?? Array.Empty<TimesheetEntryReadRow>())
                .Select(e => new AppInterfaces.TimesheetEntryResult(
                    e.Id,
                    e.ProjectId,
                    e.ProjectName,
                    e.TaskCategoryId,
                    e.TaskCategoryName,
                    e.Minutes,
                    e.Notes))
                .ToList());
    }

    public async Task<AppInterfaces.TimesheetWeekResult> GetWeekAsync(Guid userId, DateOnly anyDateInWeek, CancellationToken ct = default)
    {
        var diff = ((int)anyDateInWeek.DayOfWeek + 6) % 7;
        var weekStart = anyDateInWeek.AddDays(-diff);
        var weekEnd = weekStart.AddDays(6);

        var bundle = await timesheetReadRepository.GetWeekBundleAsync(userId, weekStart, weekEnd, ct);
        var nowUtc = DateTime.UtcNow;
        var days = new List<AppInterfaces.TimesheetWeekDayResult>();

        for (var i = 0; i < 7; i++)
        {
            var day = weekStart.AddDays(i);
            var daySessions = bundle.WorkSessions.Where(ws => ws.WorkDate == day).ToList();
            var attendanceNet = daySessions.Count > 0
                ? attendanceCalc.Calculate(daySessions.Select(ToDomainSession).ToList(), ToDomainPolicy(bundle.WorkPolicy), nowUtc).NetMinutes
                : 0;

            int expectedMinutes;
            if (day.DayOfWeek == DayOfWeek.Sunday || bundle.HolidayDates.Contains(day))
            {
                expectedMinutes = 0;
            }
            else
            {
                var approvedLeave = bundle.ApprovedLeaves.FirstOrDefault(lr => lr.LeaveDate == day);
                var baseExpected = bundle.WorkPolicy?.DailyExpectedMinutes ?? 480;
                expectedMinutes = approvedLeave is null ? baseExpected : approvedLeave.IsHalfDay ? baseExpected / 2 : 0;
            }

            var timesheet = bundle.Timesheets.FirstOrDefault(t => t.WorkDate == day);
            var entered = timesheet?.EnteredMinutes ?? 0;
            days.Add(new AppInterfaces.TimesheetWeekDayResult(
                day,
                timesheet?.Status ?? TimesheetStatus.Draft.ToString().ToLowerInvariant(),
                entered,
                attendanceNet,
                expectedMinutes,
                attendanceNet != entered));
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
        var options = await timesheetReadRepository.GetEntryOptionsAsync(ct);
        return new AppInterfaces.EntryOptionsResult(
            options.Projects.Select(p => new AppInterfaces.ProjectResult(p.Id, p.Name, p.Code, p.IsActive, p.IsArchived, p.BudgetedHours)).ToList(),
            options.TaskCategories.Select(c => new AppInterfaces.TaskCategoryResult(c.Id, c.Name, c.IsActive, c.IsBillable)).ToList());
    }

    public Task<int> GetBackdateWindowDaysAsync(Guid userId, CancellationToken ct = default)
        => timesheetReadRepository.GetBackdateWindowDaysAsync(userId, ct);

    public Task<bool> RequiresMismatchReasonAsync(Guid userId, CancellationToken ct = default)
        => timesheetReadRepository.RequiresMismatchReasonAsync(userId, ct);

    public Task<bool> IsActiveProjectAsync(Guid projectId, CancellationToken ct = default)
        => timesheetReadRepository.IsActiveProjectAsync(projectId, ct);

    public Task<bool> IsActiveTaskCategoryAsync(Guid categoryId, CancellationToken ct = default)
        => timesheetReadRepository.IsActiveTaskCategoryAsync(categoryId, ct);

    public async Task<int> GetAttendanceNetMinutesAsync(Guid userId, DateOnly date, CancellationToken ct = default)
    {
        var attendance = await timesheetReadRepository.GetAttendanceDayAsync(userId, date, ct);
        if (attendance.Sessions.Count == 0)
            return 0;

        return attendanceCalc.Calculate(
            attendance.Sessions.Select(ToDomainSession).ToList(),
            ToDomainPolicy(attendance.WorkPolicy),
            DateTime.UtcNow).NetMinutes;
    }

    public async Task<int> GetExpectedMinutesAsync(Guid userId, DateOnly date, CancellationToken ct = default)
    {
        var expected = await timesheetReadRepository.GetExpectedMinutesBaseAsync(userId, ct);
        if (date.DayOfWeek == DayOfWeek.Sunday || await timesheetReadRepository.IsHolidayAsync(date, ct))
            return 0;

        var leave = await timesheetReadRepository.GetApprovedLeaveAsync(userId, date, ct);
        return leave is null ? expected : leave.IsHalfDay ? expected / 2 : 0;
    }

    public Task<DateOnly?> GetWorkDateByEntryIdAsync(Guid entryId, Guid userId, CancellationToken ct = default)
        => timesheetReadRepository.GetWorkDateByEntryIdAsync(entryId, userId, ct);

    public Task<bool?> IsActiveUserAsync(Guid userId, CancellationToken ct = default)
        => timesheetReadRepository.IsActiveUserAsync(userId, ct);

    private static Domain.Entities.WorkSession ToDomainSession(WorkSessionReadRow row)
        => new()
        {
            UserId = Guid.Empty,
            WorkDate = row.WorkDate,
            CheckInAtUtc = row.CheckInAtUtc,
            CheckOutAtUtc = row.CheckOutAtUtc,
            Status = Enum.TryParse<WorkSessionStatus>(row.Status, true, out var status) ? status : WorkSessionStatus.Completed,
            Breaks = row.Breaks.Select(b => new Domain.Entities.BreakEntry
            {
                StartAtUtc = b.StartAtUtc,
                EndAtUtc = b.EndAtUtc,
                DurationMinutes = b.DurationMinutes,
                IsManualEdit = b.IsManualEdit
            }).ToList()
        };

    private static Domain.Entities.WorkPolicy? ToDomainPolicy(WorkPolicyReadRow? row)
        => row is null ? null : new Domain.Entities.WorkPolicy
        {
            DailyExpectedMinutes = row.DailyExpectedMinutes,
            WorkDaysPerWeek = row.WorkDaysPerWeek,
            TimesheetBackdateWindowDays = row.TimesheetBackdateWindowDays,
            RequireMismatchReason = row.RequireMismatchReason
        };
}

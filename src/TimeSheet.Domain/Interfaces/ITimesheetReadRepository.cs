namespace TimeSheet.Domain.Interfaces;

public interface ITimesheetReadRepository
{
    Task<TimesheetDayRow?> GetDayAsync(Guid userId, DateOnly date, CancellationToken ct = default);
    Task<TimesheetWeekBundleRow> GetWeekBundleAsync(Guid userId, DateOnly weekStart, DateOnly weekEnd, CancellationToken ct = default);
    Task<EntryOptionsRow> GetEntryOptionsAsync(CancellationToken ct = default);
    Task<int> GetBackdateWindowDaysAsync(Guid userId, CancellationToken ct = default);
    Task<bool> RequiresMismatchReasonAsync(Guid userId, CancellationToken ct = default);
    Task<bool> IsActiveProjectAsync(Guid projectId, CancellationToken ct = default);
    Task<bool> IsActiveTaskCategoryAsync(Guid categoryId, CancellationToken ct = default);
    Task<AttendanceDayBundleRow> GetAttendanceDayAsync(Guid userId, DateOnly date, CancellationToken ct = default);
    Task<int> GetExpectedMinutesBaseAsync(Guid userId, CancellationToken ct = default);
    Task<bool> IsHolidayAsync(DateOnly date, CancellationToken ct = default);
    Task<ApprovedLeaveDayRow?> GetApprovedLeaveAsync(Guid userId, DateOnly date, CancellationToken ct = default);
    Task<DateOnly?> GetWorkDateByEntryIdAsync(Guid entryId, Guid userId, CancellationToken ct = default);
    Task<bool?> IsActiveUserAsync(Guid userId, CancellationToken ct = default);
}

public record TimesheetEntryReadRow(Guid Id, Guid ProjectId, string ProjectName, Guid TaskCategoryId, string TaskCategoryName, int Minutes, string? Notes);
public record TimesheetDayRow(Guid TimesheetId, string Status, int EnteredMinutes, string? MismatchReason, string? ManagerComment, IReadOnlyList<TimesheetEntryReadRow> Entries);
public record WorkSessionBreakReadRow(Guid Id, DateTime StartAtUtc, DateTime? EndAtUtc, int DurationMinutes, bool IsManualEdit, bool IsActive);
public record WorkSessionReadRow(Guid Id, DateOnly WorkDate, DateTime CheckInAtUtc, DateTime? CheckOutAtUtc, string Status, IReadOnlyList<WorkSessionBreakReadRow> Breaks);
public record TimesheetWeekDayReadRow(DateOnly WorkDate, string Status, int EnteredMinutes);
public record TimesheetWeekBundleRow(
    IReadOnlyList<TimesheetWeekDayReadRow> Timesheets,
    IReadOnlyList<WorkSessionReadRow> WorkSessions,
    IReadOnlyList<ApprovedLeaveDayRow> ApprovedLeaves,
    IReadOnlyList<DateOnly> HolidayDates,
    WorkPolicyReadRow? WorkPolicy);
public record AttendanceDayBundleRow(IReadOnlyList<WorkSessionReadRow> Sessions, WorkPolicyReadRow? WorkPolicy);
public record ApprovedLeaveDayRow(DateOnly LeaveDate, bool IsHalfDay);
public record WorkPolicyReadRow(Guid Id, int DailyExpectedMinutes, int WorkDaysPerWeek, int TimesheetBackdateWindowDays, bool RequireMismatchReason);
public record ProjectOptionRow(Guid Id, string Name, string Code, bool IsActive, bool IsArchived, int BudgetedHours);
public record TaskCategoryOptionRow(Guid Id, string Name, bool IsActive, bool IsBillable);
public record EntryOptionsRow(IReadOnlyList<ProjectOptionRow> Projects, IReadOnlyList<TaskCategoryOptionRow> TaskCategories);

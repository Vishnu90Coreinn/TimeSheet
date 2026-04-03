namespace TimeSheet.Application.Common.Interfaces;

/// <summary>
/// Read-side service providing EF-backed queries for timesheet handlers and query handlers.
/// Implemented in Infrastructure; Application layer depends only on this interface.
/// </summary>
public interface ITimesheetQueryService
{
    // ── Query responses ──────────────────────────────────────────────────────

    Task<TimesheetDayResult?> GetDayAsync(Guid userId, DateOnly date, CancellationToken ct = default);

    Task<TimesheetWeekResult> GetWeekAsync(Guid userId, DateOnly anyDateInWeek, CancellationToken ct = default);

    Task<EntryOptionsResult> GetEntryOptionsAsync(CancellationToken ct = default);

    // ── Command validation helpers ────────────────────────────────────────────

    Task<int> GetBackdateWindowDaysAsync(Guid userId, CancellationToken ct = default);

    Task<bool> RequiresMismatchReasonAsync(Guid userId, CancellationToken ct = default);

    Task<bool> IsActiveProjectAsync(Guid projectId, CancellationToken ct = default);

    Task<bool> IsActiveTaskCategoryAsync(Guid categoryId, CancellationToken ct = default);

    Task<int> GetAttendanceNetMinutesAsync(Guid userId, DateOnly date, CancellationToken ct = default);

    Task<int> GetExpectedMinutesAsync(Guid userId, DateOnly date, CancellationToken ct = default);

    Task<DateOnly?> GetWorkDateByEntryIdAsync(Guid entryId, Guid userId, CancellationToken ct = default);

    Task<bool?> IsActiveUserAsync(Guid userId, CancellationToken ct = default);
}

// ── Response records ─────────────────────────────────────────────────────────

public record TimesheetEntryResult(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    Guid TaskCategoryId,
    string TaskCategoryName,
    int Minutes,
    string? Notes);

public record TimesheetDayResult(
    Guid TimesheetId,
    DateOnly WorkDate,
    string Status,
    int AttendanceNetMinutes,
    int ExpectedMinutes,
    int EnteredMinutes,
    int RemainingMinutes,
    bool HasMismatch,
    string? MismatchReason,
    string? ManagerComment,
    IReadOnlyList<TimesheetEntryResult> Entries);

public record TimesheetWeekDayResult(
    DateOnly WorkDate,
    string Status,
    int EnteredMinutes,
    int AttendanceNetMinutes,
    int ExpectedMinutes,
    bool HasMismatch);

public record TimesheetWeekResult(
    DateOnly WeekStart,
    DateOnly WeekEnd,
    int WeekEnteredMinutes,
    int WeekAttendanceMinutes,
    int WeekExpectedMinutes,
    IReadOnlyList<TimesheetWeekDayResult> Days);

public record ProjectResult(Guid Id, string Name, string Code, bool IsActive, bool IsArchived, int BudgetedHours);

public record TaskCategoryResult(Guid Id, string Name, bool IsActive, bool IsBillable);

public record EntryOptionsResult(
    IReadOnlyList<ProjectResult> Projects,
    IReadOnlyList<TaskCategoryResult> TaskCategories);

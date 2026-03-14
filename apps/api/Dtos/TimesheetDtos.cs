namespace TimeSheet.Api.Dtos;

public record SubmitTimesheetRequest(DateOnly WorkDate, string? Notes, string? MismatchReason);

public record UpsertTimesheetEntryRequest(
    DateOnly WorkDate,
    Guid? EntryId,
    Guid ProjectId,
    Guid TaskCategoryId,
    int Minutes,
    string? Notes);

public record TimesheetEntryResponse(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    Guid TaskCategoryId,
    string TaskCategoryName,
    int Minutes,
    string? Notes);

public record TimesheetDayResponse(
    Guid TimesheetId,
    DateOnly WorkDate,
    string Status,
    int AttendanceNetMinutes,
    int EnteredMinutes,
    int RemainingMinutes,
    bool HasMismatch,
    string? MismatchReason,
    IReadOnlyList<TimesheetEntryResponse> Entries);

public record TimesheetWeekDayResponse(DateOnly WorkDate, string Status, int EnteredMinutes, int AttendanceNetMinutes, bool HasMismatch);

public record TimesheetWeekResponse(DateOnly WeekStartDate, DateOnly WeekEndDate, int WeekEnteredMinutes, int WeekAttendanceNetMinutes, IReadOnlyList<TimesheetWeekDayResponse> Days);

public record CopyTimesheetRequest(DateOnly SourceDate, DateOnly TargetDate);

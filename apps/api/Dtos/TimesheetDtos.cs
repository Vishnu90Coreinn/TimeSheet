using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record SubmitTimesheetRequest(DateOnly WorkDate, [MaxLength(2000)] string? Notes, [MaxLength(1000)] string? MismatchReason);

public record SubmitWeekRequest([Required] DateOnly WeekStart);

public record SubmitWeekSkipped(string Date, string Reason);
public record SubmitWeekError(string Date, string Message);
public record SubmitWeekResponse(
    IReadOnlyList<string> Submitted,
    IReadOnlyList<SubmitWeekSkipped> Skipped,
    IReadOnlyList<SubmitWeekError> Errors
);

public record UpsertTimesheetEntryRequest(
    DateOnly WorkDate,
    Guid? EntryId,
    [Required] Guid ProjectId,
    [Required] Guid TaskCategoryId,
    [Range(1, 1440)] int Minutes,
    [MaxLength(1000)] string? Notes);

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
    int ExpectedMinutes,
    int EnteredMinutes,
    int RemainingMinutes,
    bool HasMismatch,
    string? MismatchReason,
    string? ManagerComment,
    IReadOnlyList<TimesheetEntryResponse> Entries);

public record TimesheetWeekDayResponse(DateOnly WorkDate, string Status, int EnteredMinutes, int AttendanceNetMinutes, int ExpectedMinutes, bool HasMismatch);

public record TimesheetWeekResponse(DateOnly WeekStartDate, DateOnly WeekEndDate, int WeekEnteredMinutes, int WeekAttendanceNetMinutes, int WeekExpectedMinutes, IReadOnlyList<TimesheetWeekDayResponse> Days);

public record CopyTimesheetRequest(DateOnly SourceDate, DateOnly TargetDate);

public record TimesheetExportUserDto(Guid Id, string DisplayName, string Username);

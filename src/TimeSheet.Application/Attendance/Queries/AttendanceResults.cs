namespace TimeSheet.Application.Attendance.Queries;

public record BreakEntryResult(Guid Id, DateTime StartAtUtc, DateTime? EndAtUtc, int DurationMinutes, bool IsManualEdit, bool IsActive);

public record AttendanceSummaryResult(
    Guid? ActiveSessionId,
    DateOnly WorkDate,
    string Status,
    DateTime? LastCheckInAtUtc,
    DateTime? LastCheckOutAtUtc,
    bool HasAttendanceException,
    int SessionCount,
    int GrossMinutes,
    int FixedLunchMinutes,
    int BreakMinutes,
    int NetMinutes,
    IReadOnlyCollection<BreakEntryResult> ActiveSessionBreaks);

public record SessionHistoryResult(
    Guid Id,
    DateTime CheckInAtUtc,
    DateTime? CheckOutAtUtc,
    string Status,
    bool HasAttendanceException,
    IReadOnlyCollection<BreakEntryResult> Breaks);

public record AttendanceDayHistoryResult(
    DateOnly WorkDate,
    int SessionCount,
    int GrossMinutes,
    int FixedLunchMinutes,
    int BreakMinutes,
    int NetMinutes,
    bool HasAttendanceException,
    IReadOnlyCollection<SessionHistoryResult> Sessions);

public record BreakSummaryResult(DateOnly FromDate, DateOnly ToDate, int TotalBreakMinutes, int DaysWithBreaks);
public record WorkSessionResult(Guid Id, DateTime CheckInAtUtc, DateTime? CheckOutAtUtc, int? DurationMinutes);

namespace TimeSheet.Api.Dtos;

public record CheckInRequest(DateTime? CheckInAtUtc);
public record CheckOutRequest(DateTime? CheckOutAtUtc);
public record StartBreakRequest(DateTime? StartAtUtc);
public record EndBreakRequest(DateTime? EndAtUtc);
public record ManualBreakEditRequest(Guid BreakEntryId, DateTime StartAtUtc, DateTime EndAtUtc);
public record AttendanceHistoryRequest(DateOnly? FromDate, DateOnly? ToDate);

public record BreakEntryResponse(Guid Id, DateTime StartAtUtc, DateTime? EndAtUtc, int DurationMinutes, bool IsManualEdit, bool IsActive);

public record AttendanceSummaryResponse(
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
    IReadOnlyCollection<BreakEntryResponse> ActiveSessionBreaks);

public record AttendanceDayHistoryResponse(
    DateOnly WorkDate,
    int SessionCount,
    int GrossMinutes,
    int FixedLunchMinutes,
    int BreakMinutes,
    int NetMinutes,
    bool HasAttendanceException,
    IReadOnlyCollection<SessionHistoryResponse> Sessions);

public record SessionHistoryResponse(
    Guid Id,
    DateTime CheckInAtUtc,
    DateTime? CheckOutAtUtc,
    string Status,
    bool HasAttendanceException,
    IReadOnlyCollection<BreakEntryResponse> Breaks);

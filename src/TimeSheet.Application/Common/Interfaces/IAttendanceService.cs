using TimeSheet.Application.Attendance.Commands;
using TimeSheet.Application.Attendance.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface IAttendanceService
{
    Task<AttendanceSummaryResult> CheckInAsync(Guid userId, DateTime? checkInAtUtc, CancellationToken ct = default);
    Task<AttendanceSummaryResult> CheckOutAsync(Guid userId, DateTime? checkOutAtUtc, CancellationToken ct = default);
    Task<AttendanceSummaryResult> StartBreakAsync(Guid userId, DateTime? startAtUtc, CancellationToken ct = default);
    Task<AttendanceSummaryResult> EndBreakAsync(Guid userId, DateTime? endAtUtc, CancellationToken ct = default);
    Task<AttendanceSummaryResult> ManualBreakEditAsync(Guid userId, Guid breakEntryId, DateTime startAtUtc, DateTime endAtUtc, bool isAdmin, CancellationToken ct = default);
    Task<AttendanceSummaryResult> GetTodaySummaryAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<AttendanceDayHistoryResult>> GetHistoryAsync(Guid userId, DateOnly? fromDate, DateOnly? toDate, CancellationToken ct = default);
    Task<BreakSummaryResult> GetBreakSummaryAsync(Guid userId, DateOnly? fromDate, DateOnly? toDate, CancellationToken ct = default);
    Task<IReadOnlyList<WorkSessionResult>> GetTodaySessionsAsync(Guid userId, CancellationToken ct = default);
}

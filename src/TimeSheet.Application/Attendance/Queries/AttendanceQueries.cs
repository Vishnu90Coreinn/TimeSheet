using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Attendance.Queries;

public record GetTodayAttendanceSummaryQuery : IRequest<Result<AttendanceSummaryResult>>;
public record GetAttendanceHistoryQuery(DateOnly? FromDate, DateOnly? ToDate)
    : IRequest<Result<IReadOnlyList<AttendanceDayHistoryResult>>>;
public record GetBreakSummaryQuery(DateOnly? FromDate, DateOnly? ToDate)
    : IRequest<Result<BreakSummaryResult>>;
public record GetTodayWorkSessionsQuery : IRequest<Result<IReadOnlyList<WorkSessionResult>>>;

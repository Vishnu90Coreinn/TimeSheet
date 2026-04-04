using MediatR;
using TimeSheet.Application.Attendance.Queries;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Attendance.Commands;

public record CheckInCommand(DateTime? CheckInAtUtc) : IRequest<Result<AttendanceSummaryResult>>;
public record CheckOutCommand(DateTime? CheckOutAtUtc) : IRequest<Result<AttendanceSummaryResult>>;
public record StartBreakCommand(DateTime? StartAtUtc) : IRequest<Result<AttendanceSummaryResult>>;
public record EndBreakCommand(DateTime? EndAtUtc) : IRequest<Result<AttendanceSummaryResult>>;
public record ManualBreakEditCommand(Guid BreakEntryId, DateTime StartAtUtc, DateTime EndAtUtc)
    : IRequest<Result<AttendanceSummaryResult>>;

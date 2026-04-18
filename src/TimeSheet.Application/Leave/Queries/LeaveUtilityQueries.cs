using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public record GetLeaveCalendarQuery(int Year, int Month) : IRequest<Result<IReadOnlyList<LeaveCalendarDayResult>>>;
public record GetTeamLeaveCalendarQuery(int? Year, int? Month) : IRequest<Result<IReadOnlyList<TeamLeaveCalendarDayResult>>>;
public record GetLeaveConflictsQuery(DateOnly FromDate, DateOnly ToDate, Guid? UserId) : IRequest<Result<LeaveConflictResult>>;
public record GetTeamOnLeaveQuery : IRequest<Result<IReadOnlyList<TeamOnLeaveResult>>>;

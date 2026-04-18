using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public class GetLeaveCalendarQueryHandler(ILeaveQueryService leaveQueryService, ICurrentUserService currentUserService)
    : IRequestHandler<GetLeaveCalendarQuery, Result<IReadOnlyList<LeaveCalendarDayResult>>>
{
    public async Task<Result<IReadOnlyList<LeaveCalendarDayResult>>> Handle(GetLeaveCalendarQuery request, CancellationToken cancellationToken)
        => Result<IReadOnlyList<LeaveCalendarDayResult>>.Success(
            await leaveQueryService.GetCalendarAsync(currentUserService.UserId, request.Year, request.Month, cancellationToken));
}

public class GetTeamLeaveCalendarQueryHandler(ILeaveQueryService leaveQueryService, ICurrentUserService currentUserService)
    : IRequestHandler<GetTeamLeaveCalendarQuery, Result<IReadOnlyList<TeamLeaveCalendarDayResult>>>
{
    public async Task<Result<IReadOnlyList<TeamLeaveCalendarDayResult>>> Handle(GetTeamLeaveCalendarQuery request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        return Result<IReadOnlyList<TeamLeaveCalendarDayResult>>.Success(
            await leaveQueryService.GetTeamCalendarAsync(
                currentUserService.UserId,
                currentUserService.Role,
                request.Year ?? now.Year,
                request.Month ?? now.Month,
                cancellationToken));
    }
}

public class GetLeaveConflictsQueryHandler(ILeaveQueryService leaveQueryService, ICurrentUserService currentUserService)
    : IRequestHandler<GetLeaveConflictsQuery, Result<LeaveConflictResult>>
{
    public async Task<Result<LeaveConflictResult>> Handle(GetLeaveConflictsQuery request, CancellationToken cancellationToken)
        => Result<LeaveConflictResult>.Success(
            await leaveQueryService.GetConflictsAsync(
                currentUserService.UserId,
                currentUserService.Role,
                request.FromDate,
                request.ToDate,
                request.UserId,
                cancellationToken));
}

public class GetTeamOnLeaveQueryHandler(ILeaveQueryService leaveQueryService, ICurrentUserService currentUserService)
    : IRequestHandler<GetTeamOnLeaveQuery, Result<IReadOnlyList<TeamOnLeaveResult>>>
{
    public async Task<Result<IReadOnlyList<TeamOnLeaveResult>>> Handle(GetTeamOnLeaveQuery request, CancellationToken cancellationToken)
        => Result<IReadOnlyList<TeamOnLeaveResult>>.Success(
            await leaveQueryService.GetTeamOnLeaveAsync(currentUserService.UserId, cancellationToken));
}

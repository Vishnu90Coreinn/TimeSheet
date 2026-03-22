using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public class GetLeaveBalanceQueryHandler(
    ILeaveQueryService leaveQuery,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider)
    : IRequestHandler<GetLeaveBalanceQuery, Result<List<LeaveBalanceResult>>>
{
    public async Task<Result<List<LeaveBalanceResult>>> Handle(GetLeaveBalanceQuery request, CancellationToken ct)
    {
        var targetUserId = request.TargetUserId ?? currentUser.UserId;

        if (targetUserId != currentUser.UserId && !currentUser.IsAdmin && !currentUser.IsManager)
            return Result<List<LeaveBalanceResult>>.Forbidden("Only admins and managers can view other users' leave balances.");

        var year = dateTimeProvider.TodayUtc.Year;
        var items = await leaveQuery.GetBalanceAsync(targetUserId, year, ct);
        return Result<List<LeaveBalanceResult>>.Success(items);
    }
}

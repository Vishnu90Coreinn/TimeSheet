using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Attendance.Queries;

public class GetTodayAttendanceSummaryQueryHandler(IAttendanceService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetTodayAttendanceSummaryQuery, Result<AttendanceSummaryResult>>
{
    public async Task<Result<AttendanceSummaryResult>> Handle(GetTodayAttendanceSummaryQuery request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty)
            return Result<AttendanceSummaryResult>.Forbidden("Unauthorized.");

        return Result<AttendanceSummaryResult>.Success(
            await service.GetTodaySummaryAsync(currentUserService.UserId, cancellationToken));
    }
}

public class GetAttendanceHistoryQueryHandler(IAttendanceService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetAttendanceHistoryQuery, Result<IReadOnlyList<AttendanceDayHistoryResult>>>
{
    public async Task<Result<IReadOnlyList<AttendanceDayHistoryResult>>> Handle(GetAttendanceHistoryQuery request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty)
            return Result<IReadOnlyList<AttendanceDayHistoryResult>>.Forbidden("Unauthorized.");

        try
        {
            var result = await service.GetHistoryAsync(currentUserService.UserId, request.FromDate, request.ToDate, cancellationToken);
            return Result<IReadOnlyList<AttendanceDayHistoryResult>>.Success(result);
        }
        catch (ArgumentException ex)
        {
            return Result<IReadOnlyList<AttendanceDayHistoryResult>>.ValidationFailure(ex.Message);
        }
    }
}

public class GetBreakSummaryQueryHandler(IAttendanceService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetBreakSummaryQuery, Result<BreakSummaryResult>>
{
    public async Task<Result<BreakSummaryResult>> Handle(GetBreakSummaryQuery request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty)
            return Result<BreakSummaryResult>.Forbidden("Unauthorized.");

        return Result<BreakSummaryResult>.Success(
            await service.GetBreakSummaryAsync(currentUserService.UserId, request.FromDate, request.ToDate, cancellationToken));
    }
}

public class GetTodayWorkSessionsQueryHandler(IAttendanceService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetTodayWorkSessionsQuery, Result<IReadOnlyList<WorkSessionResult>>>
{
    public async Task<Result<IReadOnlyList<WorkSessionResult>>> Handle(GetTodayWorkSessionsQuery request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty)
            return Result<IReadOnlyList<WorkSessionResult>>.Forbidden("Unauthorized.");

        return Result<IReadOnlyList<WorkSessionResult>>.Success(
            await service.GetTodaySessionsAsync(currentUserService.UserId, cancellationToken));
    }
}

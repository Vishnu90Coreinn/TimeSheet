using MediatR;
using TimeSheet.Application.Attendance.Queries;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Attendance.Commands;

public class CheckInCommandHandler(IAttendanceService service, ICurrentUserService currentUserService)
    : IRequestHandler<CheckInCommand, Result<AttendanceSummaryResult>>
{
    public async Task<Result<AttendanceSummaryResult>> Handle(CheckInCommand request, CancellationToken cancellationToken)
        => await AttendanceRequestExecutor.ExecuteAsync(
            () => service.CheckInAsync(currentUserService.UserId, request.CheckInAtUtc, cancellationToken),
            currentUserService.UserId);
}

public class CheckOutCommandHandler(IAttendanceService service, ICurrentUserService currentUserService)
    : IRequestHandler<CheckOutCommand, Result<AttendanceSummaryResult>>
{
    public async Task<Result<AttendanceSummaryResult>> Handle(CheckOutCommand request, CancellationToken cancellationToken)
        => await AttendanceRequestExecutor.ExecuteAsync(
            () => service.CheckOutAsync(currentUserService.UserId, request.CheckOutAtUtc, cancellationToken),
            currentUserService.UserId);
}

public class StartBreakCommandHandler(IAttendanceService service, ICurrentUserService currentUserService)
    : IRequestHandler<StartBreakCommand, Result<AttendanceSummaryResult>>
{
    public async Task<Result<AttendanceSummaryResult>> Handle(StartBreakCommand request, CancellationToken cancellationToken)
        => await AttendanceRequestExecutor.ExecuteAsync(
            () => service.StartBreakAsync(currentUserService.UserId, request.StartAtUtc, cancellationToken),
            currentUserService.UserId);
}

public class EndBreakCommandHandler(IAttendanceService service, ICurrentUserService currentUserService)
    : IRequestHandler<EndBreakCommand, Result<AttendanceSummaryResult>>
{
    public async Task<Result<AttendanceSummaryResult>> Handle(EndBreakCommand request, CancellationToken cancellationToken)
        => await AttendanceRequestExecutor.ExecuteAsync(
            () => service.EndBreakAsync(currentUserService.UserId, request.EndAtUtc, cancellationToken),
            currentUserService.UserId);
}

public class ManualBreakEditCommandHandler(IAttendanceService service, ICurrentUserService currentUserService)
    : IRequestHandler<ManualBreakEditCommand, Result<AttendanceSummaryResult>>
{
    public async Task<Result<AttendanceSummaryResult>> Handle(ManualBreakEditCommand request, CancellationToken cancellationToken)
        => await AttendanceRequestExecutor.ExecuteAsync(
            () => service.ManualBreakEditAsync(
                currentUserService.UserId,
                request.BreakEntryId,
                request.StartAtUtc,
                request.EndAtUtc,
                currentUserService.IsAdmin,
                cancellationToken),
            currentUserService.UserId);
}

internal static class AttendanceRequestExecutor
{
    public static async Task<Result<AttendanceSummaryResult>> ExecuteAsync(
        Func<Task<AttendanceSummaryResult>> action,
        Guid userId)
    {
        if (userId == Guid.Empty)
            return Result<AttendanceSummaryResult>.Forbidden("Unauthorized.");

        try
        {
            return Result<AttendanceSummaryResult>.Success(await action());
        }
        catch (UnauthorizedAccessException ex)
        {
            return Result<AttendanceSummaryResult>.Forbidden(ex.Message);
        }
        catch (KeyNotFoundException)
        {
            return Result<AttendanceSummaryResult>.NotFound("Attendance record not found.");
        }
        catch (ArgumentException ex)
        {
            return Result<AttendanceSummaryResult>.ValidationFailure(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Result<AttendanceSummaryResult>.Conflict(ex.Message);
        }
    }
}

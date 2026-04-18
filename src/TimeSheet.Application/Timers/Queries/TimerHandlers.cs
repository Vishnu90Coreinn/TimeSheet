using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Timers.Queries;

public class GetActiveTimerQueryHandler(ITimerService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetActiveTimerQuery, Result<TimerSessionResult>>
{
    public async Task<Result<TimerSessionResult>> Handle(GetActiveTimerQuery request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty) return Result<TimerSessionResult>.Forbidden("Unauthorized.");
        var timer = await service.GetActiveAsync(currentUserService.UserId, cancellationToken);
        return timer is null ? Result<TimerSessionResult>.NotFound("No active timer found.") : Result<TimerSessionResult>.Success(timer);
    }
}

public class StartTimerCommandHandler(ITimerService service, ICurrentUserService currentUserService)
    : IRequestHandler<StartTimerCommand, Result<TimerSessionResult>>
{
    public async Task<Result<TimerSessionResult>> Handle(StartTimerCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty) return Result<TimerSessionResult>.Forbidden("Unauthorized.");
        var result = await service.StartAsync(currentUserService.UserId, request.ProjectId, request.CategoryId, request.Note, cancellationToken);
        return result.Outcome switch
        {
            TimerStartOutcome.Started => Result<TimerSessionResult>.Success(result.Timer!),
            TimerStartOutcome.ActiveExists => Result<TimerSessionResult>.Conflict("A timer is already running. Stop it before starting a new one."),
            TimerStartOutcome.ProjectNotFound => Result<TimerSessionResult>.ValidationFailure("Project not found."),
            TimerStartOutcome.CategoryNotFound => Result<TimerSessionResult>.ValidationFailure("Category not found."),
            _ => Result<TimerSessionResult>.Failure("Timer start failed.")
        };
    }
}

public class StopTimerCommandHandler(ITimerService service, ICurrentUserService currentUserService)
    : IRequestHandler<StopTimerCommand, Result<TimerSessionResult>>
{
    public async Task<Result<TimerSessionResult>> Handle(StopTimerCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty) return Result<TimerSessionResult>.Forbidden("Unauthorized.");
        var result = await service.StopAsync(currentUserService.UserId, cancellationToken);
        return result.Outcome switch
        {
            TimerStopOutcomeType.Stopped => Result<TimerSessionResult>.Success(result.Timer!),
            TimerStopOutcomeType.NotFound => Result<TimerSessionResult>.NotFound("No active timer found."),
            _ => Result<TimerSessionResult>.Failure("Timer stop failed.")
        };
    }
}

public class ConvertTimerCommandHandler(ITimerService service, ICurrentUserService currentUserService)
    : IRequestHandler<ConvertTimerCommand, Result<(Guid EntryId, Guid TimesheetId)>>
{
    public async Task<Result<(Guid EntryId, Guid TimesheetId)>> Handle(ConvertTimerCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty) return Result<(Guid EntryId, Guid TimesheetId)>.Forbidden("Unauthorized.");
        var result = await service.ConvertAsync(currentUserService.UserId, request.TimerId, request.WorkDate, cancellationToken);
        return result.Outcome switch
        {
            TimerConvertOutcomeType.Success => Result<(Guid EntryId, Guid TimesheetId)>.Success((result.EntryId!.Value, result.TimesheetId!.Value)),
            TimerConvertOutcomeType.TimerNotFound => Result<(Guid EntryId, Guid TimesheetId)>.NotFound("Timer not found."),
            TimerConvertOutcomeType.TimerStillRunning => Result<(Guid EntryId, Guid TimesheetId)>.ValidationFailure("Timer must be stopped before converting."),
            TimerConvertOutcomeType.AlreadyConverted => Result<(Guid EntryId, Guid TimesheetId)>.Conflict("Timer has already been converted to an entry."),
            TimerConvertOutcomeType.InvalidDuration => Result<(Guid EntryId, Guid TimesheetId)>.ValidationFailure("Timer duration is invalid."),
            TimerConvertOutcomeType.TimesheetLocked => Result<(Guid EntryId, Guid TimesheetId)>.ValidationFailure("Cannot add entries to a submitted or approved timesheet."),
            _ => Result<(Guid EntryId, Guid TimesheetId)>.Failure("Timer conversion failed.")
        };
    }
}

public class GetTimerHistoryQueryHandler(ITimerService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetTimerHistoryQuery, Result<IReadOnlyList<TimerSessionResult>>>
{
    public async Task<Result<IReadOnlyList<TimerSessionResult>>> Handle(GetTimerHistoryQuery request, CancellationToken cancellationToken)
        => currentUserService.UserId == Guid.Empty
            ? Result<IReadOnlyList<TimerSessionResult>>.Forbidden("Unauthorized.")
            : Result<IReadOnlyList<TimerSessionResult>>.Success(await service.GetHistoryAsync(currentUserService.UserId, request.Date, cancellationToken));
}

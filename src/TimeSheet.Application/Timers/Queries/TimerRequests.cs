using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Timers.Queries;

public record GetActiveTimerQuery : IRequest<Result<TimerSessionResult>>;
public record StartTimerCommand(Guid ProjectId, Guid CategoryId, string? Note) : IRequest<Result<TimerSessionResult>>;
public record StopTimerCommand : IRequest<Result<TimerSessionResult>>;
public record ConvertTimerCommand(Guid TimerId, DateOnly WorkDate) : IRequest<Result<(Guid EntryId, Guid TimesheetId)>>;
public record GetTimerHistoryQuery(DateOnly? Date) : IRequest<Result<IReadOnlyList<TimerSessionResult>>>;

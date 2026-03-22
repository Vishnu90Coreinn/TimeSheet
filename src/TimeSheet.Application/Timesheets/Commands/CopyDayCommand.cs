using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Timesheets.Commands;

public record CopyDayCommand(DateOnly SourceDate, DateOnly TargetDate) : IRequest<Result<TimesheetDayResult>>;

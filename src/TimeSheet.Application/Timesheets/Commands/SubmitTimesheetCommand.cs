using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Timesheets.Commands;

public record SubmitTimesheetCommand(DateOnly WorkDate, string? Notes, string? MismatchReason) : IRequest<Result<TimesheetDayResult>>;

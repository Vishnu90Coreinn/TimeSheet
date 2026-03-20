using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Timesheets.Commands;

public record DeleteTimesheetEntryCommand(Guid EntryId, DateOnly WorkDate) : IRequest<Result<TimesheetDayResult>>;

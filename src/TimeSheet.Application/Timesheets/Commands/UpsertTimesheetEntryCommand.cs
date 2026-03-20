using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Timesheets.Commands;

public record UpsertTimesheetEntryCommand(
    DateOnly WorkDate,
    Guid? EntryId,
    Guid ProjectId,
    Guid TaskCategoryId,
    int Minutes,
    string? Notes) : IRequest<Result<TimesheetDayResult>>;

using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Timesheets.Queries;

public record GetDayTimesheetQuery(DateOnly? WorkDate) : IRequest<Result<TimesheetDayResult>>;

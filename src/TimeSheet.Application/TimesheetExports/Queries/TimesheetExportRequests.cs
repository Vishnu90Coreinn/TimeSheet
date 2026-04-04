using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.TimesheetExports.Queries;

public record GetTimesheetExportableUsersQuery : IRequest<Result<IReadOnlyList<TimesheetExportUserResult>>>;
public record BuildTimesheetExportQuery(
    DateOnly FromDate,
    DateOnly ToDate,
    Guid? UserId,
    IReadOnlyList<Guid>? UserIds) : IRequest<Result<TimesheetExportDataResult>>;

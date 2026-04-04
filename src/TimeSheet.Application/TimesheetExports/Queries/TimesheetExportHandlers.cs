using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.TimesheetExports.Queries;

public class GetTimesheetExportableUsersQueryHandler(ITimesheetExportService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetTimesheetExportableUsersQuery, Result<IReadOnlyList<TimesheetExportUserResult>>>
{
    public async Task<Result<IReadOnlyList<TimesheetExportUserResult>>> Handle(GetTimesheetExportableUsersQuery request, CancellationToken cancellationToken)
        => currentUserService.UserId == Guid.Empty
            ? Result<IReadOnlyList<TimesheetExportUserResult>>.Forbidden("Unauthorized.")
            : Result<IReadOnlyList<TimesheetExportUserResult>>.Success(
                await service.GetExportableUsersAsync(currentUserService.UserId, currentUserService.Role, cancellationToken));
}

public class BuildTimesheetExportQueryHandler(ITimesheetExportService service, ICurrentUserService currentUserService)
    : IRequestHandler<BuildTimesheetExportQuery, Result<TimesheetExportDataResult>>
{
    public async Task<Result<TimesheetExportDataResult>> Handle(BuildTimesheetExportQuery request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty)
            return Result<TimesheetExportDataResult>.Forbidden("Unauthorized.");

        try
        {
            return Result<TimesheetExportDataResult>.Success(await service.BuildExportAsync(
                currentUserService.UserId,
                currentUserService.Role,
                request.FromDate,
                request.ToDate,
                request.UserId,
                request.UserIds,
                cancellationToken));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Result<TimesheetExportDataResult>.Forbidden(ex.Message);
        }
    }
}

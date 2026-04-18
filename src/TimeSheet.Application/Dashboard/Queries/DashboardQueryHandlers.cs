using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Dashboard.Queries;

public class GetEmployeeDashboardQueryHandler(IDashboardQueryService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetEmployeeDashboardQuery, Result<EmployeeDashboardResult>>
{
    public async Task<Result<EmployeeDashboardResult>> Handle(GetEmployeeDashboardQuery request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty)
            return Result<EmployeeDashboardResult>.Forbidden("Unauthorized.");

        return Result<EmployeeDashboardResult>.Success(
            await service.GetEmployeeDashboardAsync(currentUserService.UserId, cancellationToken));
    }
}

public class GetManagerDashboardQueryHandler(IDashboardQueryService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetManagerDashboardQuery, Result<ManagerDashboardResult>>
{
    public async Task<Result<ManagerDashboardResult>> Handle(GetManagerDashboardQuery request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty)
            return Result<ManagerDashboardResult>.Forbidden("Unauthorized.");

        return Result<ManagerDashboardResult>.Success(
            await service.GetManagerDashboardAsync(currentUserService.UserId, cancellationToken));
    }
}

public class GetManagementDashboardQueryHandler(IDashboardQueryService service)
    : IRequestHandler<GetManagementDashboardQuery, Result<ManagementDashboardResult>>
{
    public async Task<Result<ManagementDashboardResult>> Handle(GetManagementDashboardQuery request, CancellationToken cancellationToken)
        => Result<ManagementDashboardResult>.Success(await service.GetManagementDashboardAsync(cancellationToken));
}

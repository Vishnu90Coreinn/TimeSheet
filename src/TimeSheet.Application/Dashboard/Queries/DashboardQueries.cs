using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Dashboard.Queries;

public record GetEmployeeDashboardQuery : IRequest<Result<EmployeeDashboardResult>>;
public record GetManagerDashboardQuery : IRequest<Result<ManagerDashboardResult>>;
public record GetManagementDashboardQuery : IRequest<Result<ManagementDashboardResult>>;

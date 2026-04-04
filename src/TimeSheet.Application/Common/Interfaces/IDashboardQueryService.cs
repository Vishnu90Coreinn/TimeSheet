using TimeSheet.Application.Dashboard.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface IDashboardQueryService
{
    Task<EmployeeDashboardResult> GetEmployeeDashboardAsync(Guid userId, CancellationToken ct = default);
    Task<ManagerDashboardResult> GetManagerDashboardAsync(Guid userId, CancellationToken ct = default);
    Task<ManagementDashboardResult> GetManagementDashboardAsync(CancellationToken ct = default);
}

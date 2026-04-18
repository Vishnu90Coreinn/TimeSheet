using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Users.Queries;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class UserQueryService(IUserRepository userRepository) : IUserQueryService
{
    public async Task<PagedResult<UserListItemResult>> GetUsersPageAsync(
        string? search,
        string? role,
        Guid? departmentId,
        bool? isActive,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (rows, totalCount, effectivePage) = await userRepository.GetPagedAsync(
            search,
            role,
            departmentId,
            isActive,
            sortBy,
            descending,
            page,
            pageSize,
            ct);

        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        return new PagedResult<UserListItemResult>(
            rows.Select(r => new UserListItemResult(
                r.Id,
                r.Username,
                r.Email,
                r.EmployeeId,
                r.Role,
                r.IsActive,
                r.DepartmentId,
                r.DepartmentName,
                r.WorkPolicyId,
                r.WorkPolicyName,
                r.LeavePolicyId,
                r.LeavePolicyName,
                r.ManagerId,
                r.ManagerUsername,
                r.OnboardingCompletedAt,
                r.LeaveWorkflowVisitedAt)).ToList(),
            effectivePage,
            pageSize,
            totalCount,
            totalPages,
            sortBy,
            descending ? "desc" : "asc");
    }
}

using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Users.Queries;

public record GetUsersPageQuery(
    string? Search,
    string? Role,
    Guid? DepartmentId,
    bool? IsActive,
    string SortBy,
    bool Descending,
    int Page,
    int PageSize) : IRequest<Result<PagedResult<UserListItemResult>>>;

public record UserListItemResult(
    Guid Id,
    string Username,
    string Email,
    string EmployeeId,
    string Role,
    bool IsActive,
    Guid? DepartmentId,
    string? DepartmentName,
    Guid? WorkPolicyId,
    string? WorkPolicyName,
    Guid? LeavePolicyId,
    string? LeavePolicyName,
    Guid? ManagerId,
    string? ManagerUsername,
    DateTime? OnboardingCompletedAt,
    DateTime? LeaveWorkflowVisitedAt);

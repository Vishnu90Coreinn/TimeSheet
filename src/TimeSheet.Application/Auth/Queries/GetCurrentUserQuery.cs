using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Auth.Queries;

public record GetCurrentUserQuery : IRequest<Result<CurrentUserResult>>;

public record CurrentUserResult(
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
    string? ManagerUsername);

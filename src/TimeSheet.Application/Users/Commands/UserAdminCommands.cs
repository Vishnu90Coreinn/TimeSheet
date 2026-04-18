using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Users.Queries;

namespace TimeSheet.Application.Users.Commands;

public record GetUserByIdQuery(Guid UserId) : IRequest<Result<UserListItemResult>>;

public record CreateUserCommand(
    string Username,
    string Email,
    string EmployeeId,
    string Password,
    string Role,
    bool IsActive,
    Guid? DepartmentId,
    Guid? WorkPolicyId,
    Guid? LeavePolicyId,
    Guid? ManagerId) : IRequest<Result<UserListItemResult>>;

public record UpdateUserCommand(
    Guid UserId,
    string Username,
    string Email,
    string EmployeeId,
    string Role,
    bool IsActive,
    Guid? DepartmentId,
    Guid? WorkPolicyId,
    Guid? LeavePolicyId,
    Guid? ManagerId) : IRequest<Result>;

public record SetUserManagerCommand(Guid UserId, Guid ManagerId) : IRequest<Result>;
public record GetUserReporteesQuery(Guid UserId) : IRequest<Result<IReadOnlyList<UserListItemResult>>>;
public record AssignUserRoleCommand(Guid UserId, string RoleName) : IRequest<Result>;

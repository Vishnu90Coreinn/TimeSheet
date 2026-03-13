namespace TimeSheet.Api.Dtos;

public record UpsertUserRequest(
    string Username,
    string Email,
    string EmployeeId,
    string Password,
    string Role,
    bool IsActive,
    Guid? DepartmentId,
    Guid? WorkPolicyId,
    Guid? ManagerId
);

public record UpdateUserRequest(
    string Username,
    string Email,
    string EmployeeId,
    string Role,
    bool IsActive,
    Guid? DepartmentId,
    Guid? WorkPolicyId,
    Guid? ManagerId
);

public record UserResponse(
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
    Guid? ManagerId,
    string? ManagerUsername
);

public record SetManagerRequest(Guid ManagerId);
public record AssignRoleRequest(string RoleName);

public record RoleResponse(Guid Id, string Name);

public record DepartmentResponse(Guid Id, string Name, bool IsActive);
public record WorkPolicyResponse(Guid Id, string Name, int DailyExpectedMinutes, bool IsActive);

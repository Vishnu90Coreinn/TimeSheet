using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record UpsertUserRequest(
    [Required][MaxLength(100)] string Username,
    [Required][EmailAddress][MaxLength(200)] string Email,
    [Required][MaxLength(50)] string EmployeeId,
    [Required][MinLength(8)] string Password,
    [Required] string Role,
    bool IsActive,
    Guid? DepartmentId,
    Guid? WorkPolicyId,
    Guid? LeavePolicyId,
    Guid? ManagerId
);

public record UpdateUserRequest(
    [Required][MaxLength(100)] string Username,
    [Required][EmailAddress][MaxLength(200)] string Email,
    [Required][MaxLength(50)] string EmployeeId,
    [Required] string Role,
    bool IsActive,
    Guid? DepartmentId,
    Guid? WorkPolicyId,
    Guid? LeavePolicyId,
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
    Guid? LeavePolicyId,
    string? LeavePolicyName,
    Guid? ManagerId,
    string? ManagerUsername
);

// ── Profile (self-service) ──────────────────────────────────────────────────

public record MyProfileResponse(
    Guid Id,
    string Username,
    string Email,
    string EmployeeId,
    string Role,
    string? DepartmentName,
    string? WorkPolicyName,
    string? LeavePolicyName,
    string? ManagerUsername
);

public record UpdateMyProfileRequest(
    [Required][MaxLength(100)] string Username,
    [Required][EmailAddress][MaxLength(200)] string Email
);

public record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required][MinLength(8)] string NewPassword
);

public record NotificationPreferencesResponse(
    bool OnApproval,
    bool OnRejection,
    bool OnLeaveStatus,
    bool OnReminder,
    bool InAppEnabled,
    bool EmailEnabled
);

public record UpdateNotificationPreferencesRequest(
    bool OnApproval,
    bool OnRejection,
    bool OnLeaveStatus,
    bool OnReminder,
    bool InAppEnabled,
    bool EmailEnabled
);

// ── Admin ───────────────────────────────────────────────────────────────────

public record SetManagerRequest(Guid ManagerId);
public record AssignRoleRequest([Required] string RoleName);

public record RoleResponse(Guid Id, string Name);

public record DepartmentResponse(Guid Id, string Name, bool IsActive);
public record WorkPolicyResponse(Guid Id, string Name, int DailyExpectedMinutes, int WorkDaysPerWeek, bool IsActive);

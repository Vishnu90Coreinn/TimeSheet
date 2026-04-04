using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<User?> GetByUsernameOrEmailAsync(string identifier, CancellationToken ct = default);
    Task<IReadOnlyList<User>> GetDirectReportsAsync(Guid managerId, CancellationToken ct = default);
    Task<IReadOnlyList<User>> GetActiveUsersAsync(CancellationToken ct = default);
    Task<(IReadOnlyList<PagedUserRow> Items, int TotalCount, int Page)> GetPagedAsync(
        string? search,
        string? role,
        Guid? departmentId,
        bool? isActive,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);
    void Add(User user);
    void Update(User user);
    Task<User?> GetWithDetailsAsync(Guid id, CancellationToken ct = default);
}

public record PagedUserRow(
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

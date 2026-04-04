using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Users.Commands;
using TimeSheet.Application.Users.Queries;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class UserAdminService(
    IUserAdminRepository repository,
    IRoleRepository roleRepository,
    IPasswordHasher passwordHasher,
    TimeSheet.Application.Common.Interfaces.IAuditService auditService,
    IUnitOfWork unitOfWork) : IUserAdminService
{
    public async Task<UserListItemResult?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => Map(await repository.GetByIdWithDetailsAsync(id, ct));

    public async Task<UserListItemResult> CreateAsync(CreateUserCommand command, CancellationToken ct = default)
    {
        if (await repository.ExistsDuplicateAsync(command.Username, command.Email, command.EmployeeId, null, ct))
            throw new InvalidOperationException("Username, email, or employee id already exists.");
        if (command.ManagerId.HasValue && !await repository.ExistsAsync(command.ManagerId.Value, ct))
            throw new ArgumentException("Manager does not exist.");
        var role = await roleRepository.GetByNameAsync(command.Role, ct) ?? throw new ArgumentException("Invalid role.");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = command.Username.Trim(),
            Email = command.Email.Trim(),
            EmployeeId = command.EmployeeId.Trim(),
            PasswordHash = passwordHasher.Hash(command.Password),
            Role = command.Role,
            IsActive = command.IsActive,
            DepartmentId = command.DepartmentId,
            WorkPolicyId = command.WorkPolicyId,
            LeavePolicyId = command.LeavePolicyId,
            ManagerId = command.ManagerId
        };
        repository.Add(user);
        repository.SyncRole(user, role.Id);
        await unitOfWork.SaveChangesAsync(ct);
        return Map((await repository.GetByIdWithDetailsAsync(user.Id, ct))!)!;
    }

    public async Task<UserUpdateOutcome> UpdateAsync(UpdateUserCommand command, CancellationToken ct = default)
    {
        var user = await repository.GetByIdWithRolesAsync(command.UserId, ct);
        if (user is null) return UserUpdateOutcome.NotFound;
        var role = await roleRepository.GetByNameAsync(command.Role, ct);
        if (role is null) return UserUpdateOutcome.InvalidRole;
        if (await repository.ExistsDuplicateAsync(command.Username, command.Email, command.EmployeeId, command.UserId, ct)) return UserUpdateOutcome.Duplicate;
        if (command.ManagerId == command.UserId) return UserUpdateOutcome.InvalidManager;

        user.Username = command.Username.Trim();
        user.Email = command.Email.Trim();
        user.EmployeeId = command.EmployeeId.Trim();
        user.Role = command.Role;
        user.IsActive = command.IsActive;
        user.DepartmentId = command.DepartmentId;
        user.WorkPolicyId = command.WorkPolicyId;
        user.LeavePolicyId = command.LeavePolicyId;
        user.ManagerId = command.ManagerId;
        repository.SyncRole(user, role.Id);
        await unitOfWork.SaveChangesAsync(ct);
        return UserUpdateOutcome.Success;
    }

    public async Task<UserUpdateOutcome> SetManagerAsync(Guid userId, Guid managerId, Guid? actorUserId, CancellationToken ct = default)
    {
        if (userId == managerId) return UserUpdateOutcome.InvalidManager;
        var user = await repository.GetByIdWithRolesAsync(userId, ct);
        var manager = await repository.GetByIdWithRolesAsync(managerId, ct);
        if (user is null || manager is null) return UserUpdateOutcome.NotFound;
        user.ManagerId = managerId;
        await auditService.WriteAsync("ManagerAssigned", "User", user.Id.ToString(), $"Assigned manager {manager.Username} to {user.Username}", actorUserId);
        await unitOfWork.SaveChangesAsync(ct);
        return UserUpdateOutcome.Success;
    }

    public async Task<IReadOnlyList<UserListItemResult>> GetReporteesAsync(Guid managerId, CancellationToken ct = default)
        => (await repository.GetReporteesAsync(managerId, ct)).Select(Map).Where(x => x is not null).Cast<UserListItemResult>().ToList();

    public async Task<UserUpdateOutcome> AssignRoleAsync(Guid userId, string roleName, Guid? actorUserId, CancellationToken ct = default)
    {
        var user = await repository.GetByIdWithRolesAsync(userId, ct);
        var role = await roleRepository.GetByNameAsync(roleName, ct);
        if (user is null || role is null) return user is null ? UserUpdateOutcome.NotFound : UserUpdateOutcome.InvalidRole;
        if (user.Role == roleName && user.UserRoles.Count == 1 && user.UserRoles.Any(ur => ur.RoleId == role.Id)) return UserUpdateOutcome.RoleAlreadyAssigned;
        repository.SyncRole(user, role.Id);
        user.Role = roleName;
        await auditService.WriteAsync("RoleAssigned", "User", user.Id.ToString(), $"Assigned role {role.Name} to {user.Username}", actorUserId);
        await unitOfWork.SaveChangesAsync(ct);
        return UserUpdateOutcome.Success;
    }

    private static UserListItemResult? Map(User? user) => user is null ? null : new UserListItemResult(
        user.Id,
        user.Username,
        user.Email,
        user.EmployeeId,
        user.Role,
        user.IsActive,
        user.DepartmentId,
        user.Department?.Name,
        user.WorkPolicyId,
        user.WorkPolicy?.Name,
        user.LeavePolicyId,
        user.LeavePolicy?.Name,
        user.ManagerId,
        user.Manager?.Username,
        user.OnboardingCompletedAt,
        user.LeaveWorkflowVisitedAt);
}

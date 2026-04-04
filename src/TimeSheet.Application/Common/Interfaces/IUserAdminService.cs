using TimeSheet.Application.Users.Commands;
using TimeSheet.Application.Users.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface IUserAdminService
{
    Task<UserListItemResult?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<UserListItemResult> CreateAsync(CreateUserCommand command, CancellationToken ct = default);
    Task<UserUpdateOutcome> UpdateAsync(UpdateUserCommand command, CancellationToken ct = default);
    Task<UserUpdateOutcome> SetManagerAsync(Guid userId, Guid managerId, Guid? actorUserId, CancellationToken ct = default);
    Task<IReadOnlyList<UserListItemResult>> GetReporteesAsync(Guid managerId, CancellationToken ct = default);
    Task<UserUpdateOutcome> AssignRoleAsync(Guid userId, string roleName, Guid? actorUserId, CancellationToken ct = default);
}

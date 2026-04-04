using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IUserAdminRepository
{
    Task<User?> GetByIdWithDetailsAsync(Guid userId, CancellationToken ct = default);
    Task<User?> GetByIdWithRolesAsync(Guid userId, CancellationToken ct = default);
    Task<bool> ExistsDuplicateAsync(string username, string email, string employeeId, Guid? excludeUserId = null, CancellationToken ct = default);
    Task<bool> ExistsAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<User>> GetReporteesAsync(Guid managerId, CancellationToken ct = default);
    void Add(User user);
    void SyncRole(User user, Guid roleId);
}

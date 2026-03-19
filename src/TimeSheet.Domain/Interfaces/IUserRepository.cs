using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<User?> GetByUsernameOrEmailAsync(string identifier, CancellationToken ct = default);
    Task<IReadOnlyList<User>> GetDirectReportsAsync(Guid managerId, CancellationToken ct = default);
    Task<IReadOnlyList<User>> GetActiveUsersAsync(CancellationToken ct = default);
    void Add(User user);
    void Update(User user);
}

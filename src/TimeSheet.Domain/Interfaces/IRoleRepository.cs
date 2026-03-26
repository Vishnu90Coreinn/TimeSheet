using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IRoleRepository
{
    Task<IReadOnlyList<Role>> GetAllAsync(CancellationToken ct = default);
    Task<bool> ExistsAsync(string name, CancellationToken ct = default);
    void Add(Role role);
}

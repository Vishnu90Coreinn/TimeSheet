using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IWorkPolicyRepository
{
    Task<IReadOnlyList<WorkPolicy>> GetAllAsync(CancellationToken ct = default);
    Task<WorkPolicy?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> ExistsAsync(string name, Guid? excludeId = null, CancellationToken ct = default);
    void Add(WorkPolicy policy);
    void Remove(WorkPolicy policy);
}

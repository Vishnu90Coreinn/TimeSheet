using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IOvertimePolicyRepository
{
    Task<OvertimePolicy?> GetByWorkPolicyIdAsync(Guid workPolicyId, CancellationToken ct = default);
    Task<IReadOnlyDictionary<Guid, OvertimePolicy>> GetByWorkPolicyIdsAsync(IEnumerable<Guid> workPolicyIds, CancellationToken ct = default);
    void Add(OvertimePolicy policy);
}


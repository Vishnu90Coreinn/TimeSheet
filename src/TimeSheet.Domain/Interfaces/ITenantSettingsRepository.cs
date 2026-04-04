using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface ITenantSettingsRepository
{
    Task<TenantSettings?> GetAsync(CancellationToken ct = default);
    void Add(TenantSettings settings);
}

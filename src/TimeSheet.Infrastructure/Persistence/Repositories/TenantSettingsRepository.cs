using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class TenantSettingsRepository(TimeSheetDbContext context) : ITenantSettingsRepository
{
    public async Task<TenantSettings?> GetAsync(CancellationToken ct = default)
        => await context.TenantSettings.FirstOrDefaultAsync(ct);

    public void Add(TenantSettings settings) => context.TenantSettings.Add(settings);
}

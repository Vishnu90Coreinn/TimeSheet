using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class PushSubscriptionRepository(TimeSheetDbContext context) : IPushSubscriptionRepository
{
    public async Task<PushSubscription?> GetByEndpointAsync(string endpoint, CancellationToken ct = default)
        => await context.PushSubscriptions.FirstOrDefaultAsync(p => p.Endpoint == endpoint, ct);

    public void Add(PushSubscription subscription) => context.PushSubscriptions.Add(subscription);

    public void Remove(PushSubscription subscription) => context.PushSubscriptions.Remove(subscription);
}

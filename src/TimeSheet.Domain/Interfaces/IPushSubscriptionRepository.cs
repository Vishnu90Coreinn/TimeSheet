using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IPushSubscriptionRepository
{
    Task<PushSubscription?> GetByEndpointAsync(string endpoint, CancellationToken ct = default);
    void Add(PushSubscription subscription);
    void Remove(PushSubscription subscription);
}

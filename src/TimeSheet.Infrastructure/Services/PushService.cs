using Microsoft.Extensions.Configuration;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class PushService(IPushSubscriptionRepository repository, IUnitOfWork unitOfWork, IConfiguration configuration) : IPushService
{
    public string GetVapidPublicKey() => configuration["WebPush:VapidPublicKey"] ?? string.Empty;

    public async Task SubscribeAsync(Guid userId, string endpoint, string p256dh, string auth, CancellationToken ct = default)
    {
        var existing = await repository.GetByEndpointAsync(endpoint, ct);
        if (existing is not null)
        {
            existing.P256dh = p256dh;
            existing.Auth = auth;
        }
        else
        {
            repository.Add(new PushSubscription { UserId = userId, Endpoint = endpoint, P256dh = p256dh, Auth = auth });
        }

        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task UnsubscribeAsync(string endpoint, CancellationToken ct = default)
    {
        var existing = await repository.GetByEndpointAsync(endpoint, ct);
        if (existing is null) return;
        repository.Remove(existing);
        await unitOfWork.SaveChangesAsync(ct);
    }
}

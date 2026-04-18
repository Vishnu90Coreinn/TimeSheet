namespace TimeSheet.Application.Common.Interfaces;

public interface IPushService
{
    string GetVapidPublicKey();
    Task SubscribeAsync(Guid userId, string endpoint, string p256dh, string auth, CancellationToken ct = default);
    Task UnsubscribeAsync(string endpoint, CancellationToken ct = default);
}

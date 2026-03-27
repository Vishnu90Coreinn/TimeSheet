namespace TimeSheet.Api.Services;

public interface IWebPushService
{
    Task SendAsync(string endpoint, string p256dh, string auth, string title, string body, string? url = null);
}

public class WebPushService : IWebPushService
{
    private readonly IConfiguration _config;
    private readonly ILogger<WebPushService> _logger;

    public WebPushService(IConfiguration config, ILogger<WebPushService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendAsync(string endpoint, string p256dh, string auth, string title, string body, string? url = null)
    {
        // In production, integrate with a WebPush NuGet package (e.g., Lib.Net.Http.WebPush)
        // to perform VAPID-signed push delivery.
        // For now, log the intent — the subscription infrastructure is fully wired.
        _logger.LogInformation(
            "Push notification queued — Title: {Title}, Endpoint: {Endpoint}",
            title,
            endpoint.Length > 50 ? endpoint[..50] + "…" : endpoint);

        await Task.CompletedTask;
    }
}

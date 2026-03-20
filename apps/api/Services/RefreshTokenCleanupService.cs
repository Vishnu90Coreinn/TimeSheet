using Microsoft.EntityFrameworkCore;

namespace TimeSheet.Api.Services;

public class RefreshTokenCleanupService(IServiceProvider serviceProvider, ILogger<RefreshTokenCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var nextRun = now.Date.AddDays(1).AddHours(2); // 02:00 UTC daily
            var delay = nextRun - now;
            if (delay < TimeSpan.Zero) delay = TimeSpan.FromHours(24);

            try { await Task.Delay(delay, stoppingToken); } catch (OperationCanceledException) { break; }

            try
            {
                using var scope = serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
                var deleted = await db.RefreshTokens
                    .Where(rt => rt.IsRevoked || rt.ExpiresAtUtc < DateTime.UtcNow)
                    .ExecuteDeleteAsync(stoppingToken);
                logger.LogInformation("Refresh token cleanup: deleted {Count} expired/revoked tokens", deleted);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Refresh token cleanup job failed");
            }
        }
    }
}

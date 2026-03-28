using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TimeSheet.Infrastructure.Persistence;

namespace TimeSheet.Infrastructure.BackgroundJobs;

public class RetentionEnforcementService(IServiceScopeFactory scopeFactory, ILogger<RetentionEnforcementService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            // Run daily at 03:00 UTC
            var nextRun = now.Date.AddDays(1).AddHours(3);
            await Task.Delay(nextRun - now, ct);

            try
            {
                await EnforceRetentionAsync(ct);
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                logger.LogError(ex, "Retention enforcement failed");
            }
        }
    }

    private async Task EnforceRetentionAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();

        var policies = await db.RetentionPolicies.AsNoTracking().ToListAsync(ct);

        int GetDays(string dataType, int defaultDays)
        {
            var p = policies.FirstOrDefault(x => x.DataType == dataType);
            return p?.RetentionDays ?? defaultDays;
        }

        var now = DateTime.UtcNow;

        // Audit logs
        var auditCutoff = now.AddDays(-GetDays("auditlogs", 365));
        var auditDeleted = await db.AuditLogs
            .Where(a => a.CreatedAtUtc < auditCutoff)
            .ExecuteDeleteAsync(ct);

        // Notifications
        var notifCutoff = now.AddDays(-GetDays("notifications", 90));
        var notifDeleted = await db.Notifications
            .Where(n => n.CreatedAtUtc < notifCutoff)
            .ExecuteDeleteAsync(ct);

        // Completed work sessions
        var sessionCutoff = DateOnly.FromDateTime(now.AddDays(-GetDays("sessions", 180)));
        var sessionDeleted = await db.WorkSessions
            .Where(s => s.WorkDate < sessionCutoff && s.Status != Domain.Enums.WorkSessionStatus.Active)
            .ExecuteDeleteAsync(ct);

        logger.LogInformation(
            "Retention enforcement: deleted {Audit} audit logs, {Notif} notifications, {Sessions} sessions",
            auditDeleted, notifDeleted, sessionDeleted);
    }
}

using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Services;

public class NotificationSchedulerService(IServiceProvider serviceProvider, ILogger<NotificationSchedulerService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var nextRun = now.Date.AddDays(1).AddHours(6); // 06:00 UTC daily
            var delay = nextRun - now;
            if (delay < TimeSpan.Zero) delay = TimeSpan.FromHours(24);

            try { await Task.Delay(delay, stoppingToken); } catch (OperationCanceledException) { break; }

            try
            {
                await RunJobsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Notification scheduler job failed");
            }
        }
    }

    private async Task RunJobsAsync(CancellationToken ct)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var notifService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        // Load all preferences once — users with no record get defaults (all on)
        var allPrefs = await db.UserNotificationPreferences.AsNoTracking().ToListAsync(ct);
        bool WantsReminder(Guid userId)
        {
            var p = allPrefs.FirstOrDefault(x => x.UserId == userId);
            return p is null || (p.OnReminder && p.InAppEnabled);
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Missing checkout: active sessions from prior days
        var staleSessionUserIds = await db.WorkSessions
            .Where(ws => ws.WorkDate < today && ws.Status == WorkSessionStatus.Active)
            .Select(ws => ws.UserId)
            .Distinct()
            .ToListAsync(ct);

        foreach (var userId in staleSessionUserIds.Where(WantsReminder))
        {
            await notifService.CreateAsync(userId, "Missing Check-out",
                "You have an active session from a previous day that was not checked out. Please review your attendance.", NotificationType.MissingCheckout);
        }

        // Missing timesheet: users with attendance yesterday but no timesheet
        var yesterday = today.AddDays(-1);
        var attendedUserIds = await db.WorkSessions
            .Where(ws => ws.WorkDate == yesterday)
            .Select(ws => ws.UserId)
            .Distinct()
            .ToListAsync(ct);

        var withTimesheetIds = await db.Timesheets
            .Where(t => t.WorkDate == yesterday && attendedUserIds.Contains(t.UserId))
            .Select(t => t.UserId)
            .ToListAsync(ct);

        var missingTimesheetUserIds = attendedUserIds.Except(withTimesheetIds);
        foreach (var userId in missingTimesheetUserIds.Where(WantsReminder))
        {
            await notifService.CreateAsync(userId, "Missing Timesheet",
                $"You have not submitted a timesheet for {yesterday:yyyy-MM-dd}. Please complete it.", NotificationType.MissingTimesheet);
        }

        // Pending approvals: managers with timesheets pending > 24 hours
        var cutoff = DateTime.UtcNow.AddHours(-24);
        var pendingManagerIds = await db.Timesheets
            .Where(t => t.Status == TimesheetStatus.Submitted && t.SubmittedAtUtc <= cutoff)
            .Select(t => t.User.ManagerId)
            .Where(mid => mid != null)
            .Distinct()
            .ToListAsync(ct);

        foreach (var managerId in pendingManagerIds.Where(mid => mid.HasValue).Select(mid => mid!.Value))
        {
            if (!WantsReminder(managerId)) continue;
            await notifService.CreateAsync(managerId, "Pending Timesheet Approvals",
                "You have timesheet submissions waiting for your approval for more than 24 hours.", NotificationType.PendingApproval);
        }

        logger.LogInformation("Notification scheduler completed at {Time}", DateTime.UtcNow);
    }
}

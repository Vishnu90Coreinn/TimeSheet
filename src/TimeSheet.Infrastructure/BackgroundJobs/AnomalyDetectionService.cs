using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TimeSheet.Domain.Enums;
using TimeSheet.Infrastructure.Persistence;
using TimeSheet.Infrastructure.Services;

namespace TimeSheet.Infrastructure.BackgroundJobs;

public class AnomalyDetectionService(IServiceProvider serviceProvider, ILogger<AnomalyDetectionService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var nextRun = now.Date.AddDays(1).AddHours(7); // 07:00 UTC daily
            var delay = nextRun - now;
            if (delay < TimeSpan.Zero) delay = TimeSpan.FromHours(24);

            try { await Task.Delay(delay, stoppingToken); } catch (OperationCanceledException) { break; }

            try
            {
                await RunJobsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Anomaly detection job failed");
            }
        }
    }

    private async Task RunJobsAsync(CancellationToken ct)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var notifService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        // Load all admin user IDs
        var adminIds = await db.Users
            .Where(u => u.IsActive && u.Role == "admin")
            .Select(u => u.Id)
            .ToListAsync(ct);

        if (adminIds.Count == 0) return;

        int count = 0;

        // Helper: check deduplication — skip if an Anomaly notification with the same title
        // was already created for ANY admin in the last 7 days.
        async Task<bool> IsDuplicateAsync(string title)
        {
            return await db.Notifications.AnyAsync(
                n => n.Type == NotificationType.Anomaly
                     && n.Title == title
                     && n.CreatedAtUtc >= DateTime.UtcNow.AddDays(-7),
                ct);
        }

        async Task FireAsync(string title, string message)
        {
            if (await IsDuplicateAsync(title)) return;
            foreach (var adminId in adminIds)
                await notifService.CreateAsync(adminId, title, message, NotificationType.Anomaly);
            count++;
        }

        // --- Rule A: ExcessiveDailyHours (>12h = 720 min in a single day, last 7 days) ---
        var sevenDaysAgo = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7));
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var excessiveTimesheets = await db.Timesheets
            .Include(t => t.User)
            .Include(t => t.Entries)
            .Where(t => t.WorkDate >= sevenDaysAgo && t.WorkDate < today)
            .ToListAsync(ct);

        foreach (var ts in excessiveTimesheets)
        {
            var totalMinutes = ts.Entries.Sum(e => e.Minutes);
            if (totalMinutes > 720)
            {
                var username = ts.User.DisplayName;
                var hours = totalMinutes / 60.0;
                var date = ts.WorkDate;
                var title = $"Excessive Hours: {username}";
                var message = $"{username} logged {hours:F1}h on {date:yyyy-MM-dd} (limit: 12h).";
                await FireAsync(title, message);
            }
        }

        // --- Rule B: ExtendedMissingTimesheet (5+ consecutive working days) ---
        var activeUsers = await db.Users
            .Where(u => u.IsActive)
            .Select(u => new { u.Id, u.DisplayName })
            .ToListAsync(ct);

        // Build list of last 10 working days (Mon–Sat, skip Sun)
        var workingDays = new List<DateOnly>();
        var checkDate = today.AddDays(-1);
        while (workingDays.Count < 10)
        {
            if (checkDate.DayOfWeek != DayOfWeek.Sunday)
                workingDays.Add(checkDate);
            checkDate = checkDate.AddDays(-1);
        }

        // Fetch all timesheets in the relevant date range for all active users at once
        var minDate = workingDays[^1];
        var maxDate = workingDays[0];
        var submittedDates = await db.Timesheets
            .Where(t => t.WorkDate >= minDate && t.WorkDate <= maxDate)
            .Select(t => new { t.UserId, t.WorkDate })
            .ToListAsync(ct);

        var submittedLookup = submittedDates
            .Select(x => (x.UserId, x.WorkDate))
            .ToHashSet();

        foreach (var user in activeUsers)
        {
            int streak = 0;
            foreach (var wd in workingDays)
            {
                if (!submittedLookup.Contains((user.Id, wd)))
                    streak++;
                else
                    break;
            }

            if (streak >= 5)
            {
                var title = $"Missing Timesheets: {user.DisplayName}";
                var message = $"{user.DisplayName} has not logged a timesheet for {streak} consecutive working days.";
                await FireAsync(title, message);
            }
        }

        // --- Rule C & D: ProjectBudgetWarning / ProjectBudgetCritical ---
        var activeProjects = await db.Projects
            .Where(p => p.BudgetedHours > 0 && p.IsActive && !p.IsArchived)
            .Select(p => new { p.Id, p.Name, p.BudgetedHours })
            .ToListAsync(ct);

        // Sum minutes per project via TimesheetEntries
        var projectMinutes = await db.TimesheetEntries
            .Where(e => activeProjects.Select(p => p.Id).Contains(e.ProjectId))
            .GroupBy(e => e.ProjectId)
            .Select(g => new { ProjectId = g.Key, TotalMinutes = g.Sum(e => e.Minutes) })
            .ToListAsync(ct);

        var minutesDict = projectMinutes.ToDictionary(x => x.ProjectId, x => x.TotalMinutes);

        foreach (var project in activeProjects)
        {
            var loggedMinutes = minutesDict.TryGetValue(project.Id, out var m) ? m : 0;
            var loggedHours = loggedMinutes / 60.0;
            var pct = loggedHours / project.BudgetedHours * 100.0;

            if (pct >= 95)
            {
                var title = $"Budget Critical: {project.Name}";
                var message = $"{project.Name} has used {pct:F0}% of its {project.BudgetedHours}h budget ({loggedHours:F1}h logged).";
                await FireAsync(title, message);
            }
            else if (pct >= 80)
            {
                var title = $"Budget Warning: {project.Name}";
                var message = $"{project.Name} has used {pct:F0}% of its {project.BudgetedHours}h budget ({loggedHours:F1}h logged).";
                await FireAsync(title, message);
            }
        }

        // --- Rule E: ComplianceDropped ---
        var nowUtc = DateTime.UtcNow;
        var activeUserCount = await db.Users.CountAsync(u => u.IsActive, ct);

        if (activeUserCount > 0)
        {
            // Current month
            var currentMonthStart = new DateOnly(nowUtc.Year, nowUtc.Month, 1);
            var currentMonthEnd = today.AddDays(-1); // up to yesterday

            // Prior month
            var priorMonthDate = new DateOnly(nowUtc.Year, nowUtc.Month, 1).AddMonths(-1);
            var priorMonthStart = priorMonthDate;
            var priorMonthEnd = new DateOnly(nowUtc.Year, nowUtc.Month, 1).AddDays(-1);

            int CountWorkingDays(DateOnly start, DateOnly end)
            {
                int count = 0;
                var d = start;
                while (d <= end)
                {
                    if (d.DayOfWeek != DayOfWeek.Sunday)
                        count++;
                    d = d.AddDays(1);
                }
                return count;
            }

            var currentWorkingDays = CountWorkingDays(currentMonthStart, currentMonthEnd);
            var priorWorkingDays = CountWorkingDays(priorMonthStart, priorMonthEnd);

            if (currentWorkingDays > 0 && priorWorkingDays > 0)
            {
                var currentSubmitted = await db.Timesheets
                    .CountAsync(t => t.WorkDate >= currentMonthStart
                                     && t.WorkDate <= currentMonthEnd
                                     && (int)t.Status >= (int)TimesheetStatus.Submitted, ct);

                var priorSubmitted = await db.Timesheets
                    .CountAsync(t => t.WorkDate >= priorMonthStart
                                     && t.WorkDate <= priorMonthEnd
                                     && (int)t.Status >= (int)TimesheetStatus.Submitted, ct);

                var currentCompliance = (double)currentSubmitted / (currentWorkingDays * activeUserCount) * 100.0;
                var priorCompliance = (double)priorSubmitted / (priorWorkingDays * activeUserCount) * 100.0;
                var drop = priorCompliance - currentCompliance;

                if (drop >= 15 && priorCompliance > 0)
                {
                    const string title = "Compliance Dropped";
                    var message = $"Timesheet compliance dropped from {priorCompliance:F0}% last month to {currentCompliance:F0}% this month (Δ{drop:F0}%).";
                    await FireAsync(title, message);
                }
            }
        }

        logger.LogInformation("Anomaly detection completed, {Count} anomalies fired", count);
    }
}

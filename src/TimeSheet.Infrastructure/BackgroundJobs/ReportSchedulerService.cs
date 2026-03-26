using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TimeSheet.Domain.Enums;
using TimeSheet.Infrastructure.Persistence;

namespace TimeSheet.Infrastructure.BackgroundJobs;

public class ReportSchedulerService(
    IServiceScopeFactory scopeFactory,
    ILogger<ReportSchedulerService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var now = DateTime.UtcNow;
                // Run at the top of each hour
                var nextRun = now.AddHours(1).Date.AddHours(now.AddHours(1).Hour);
                var delay = nextRun - now;
                if (delay.TotalSeconds < 60) delay = TimeSpan.FromMinutes(1);
                await Task.Delay(delay, stoppingToken);

                await ProcessDueReportsAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                logger.LogError(ex, "ReportSchedulerService error");
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
        }
    }

    private async Task ProcessDueReportsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var now = DateTime.UtcNow;

        var dueReports = await db.SavedReports
            .Where(r => r.ScheduleType != ScheduleType.None)
            .ToListAsync(ct);

        foreach (var report in dueReports)
        {
            try
            {
                var isDue = report.ScheduleType switch
                {
                    ScheduleType.Weekly =>
                        now.DayOfWeek == (report.ScheduleDayOfWeek ?? DayOfWeek.Monday) &&
                        now.Hour == report.ScheduleHour &&
                        (report.LastRunAt == null || report.LastRunAt.Value.Date < now.Date),
                    ScheduleType.Monthly =>
                        now.Day == 1 &&
                        now.Hour == report.ScheduleHour &&
                        (report.LastRunAt == null || report.LastRunAt.Value.Date < now.Date),
                    _ => false
                };

                if (!isDue) continue;

                var recipients = JsonSerializer.Deserialize<List<string>>(report.RecipientEmailsJson) ?? [];
                logger.LogInformation(
                    "Scheduled report '{Name}' (key={Key}) due for {Count} recipients — stub delivery",
                    report.Name, report.ReportKey, recipients.Count);
                // TODO: generate and email when SMTP is configured

                report.LastRunAt = now;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to process scheduled report {Id}", report.Id);
            }
        }

        await db.SaveChangesAsync(ct);
    }
}

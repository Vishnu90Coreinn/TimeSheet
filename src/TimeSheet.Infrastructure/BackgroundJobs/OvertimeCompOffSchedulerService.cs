using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Infrastructure.Persistence;

namespace TimeSheet.Infrastructure.BackgroundJobs;

public class OvertimeCompOffSchedulerService(IServiceProvider serviceProvider, ILogger<OvertimeCompOffSchedulerService> logger) : BackgroundService
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
                await RunWeeklyCreditJob(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Overtime comp-off scheduler failed");
            }
        }
    }

    private async Task RunWeeklyCreditJob(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        // Credit once weekly on Monday for the week that just ended.
        if (today.DayOfWeek != DayOfWeek.Monday)
            return;

        var weekEnd = today.AddDays(-1);
        var weekStart = weekEnd.AddDays(-6);

        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
        var overtime = scope.ServiceProvider.GetRequiredService<IOvertimeCalculationService>();

        var approvedUserIds = await db.Timesheets
            .AsNoTracking()
            .Where(t => t.WorkDate >= weekStart && t.WorkDate <= weekEnd && t.Status == Domain.Enums.TimesheetStatus.Approved)
            .Select(t => t.UserId)
            .Distinct()
            .ToListAsync(ct);

        var credited = 0;
        foreach (var userId in approvedUserIds)
        {
            var summary = await overtime.CalculateUserWeekAsync(userId, weekStart, approvedOnly: true, ct);
            if (summary.CompOffCredits <= 0m)
                continue;

            var policy = await db.Users
                .AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new
                {
                    u.WorkPolicyId,
                    Expiry = db.OvertimePolicies
                        .Where(op => op.WorkPolicyId == u.WorkPolicyId)
                        .Select(op => (int?)op.CompOffExpiryDays)
                        .FirstOrDefault()
                })
                .SingleOrDefaultAsync(ct);

            var expiryDays = policy?.Expiry ?? 90;
            var expiresAt = weekEnd.ToDateTime(TimeOnly.MaxValue).AddDays(expiryDays);

            var exists = await db.CompOffBalances
                .AnyAsync(x => x.UserId == userId && x.ExpiresAt == expiresAt, ct);

            if (exists)
                continue;

            db.CompOffBalances.Add(new Domain.Entities.CompOffBalance
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Credits = summary.CompOffCredits,
                ExpiresAt = expiresAt,
                CreatedAtUtc = DateTime.UtcNow
            });
            credited++;
        }

        if (credited > 0)
            await db.SaveChangesAsync(ct);

        logger.LogInformation("Overtime comp-off job completed for week {WeekStart}..{WeekEnd}. Credited users: {Count}", weekStart, weekEnd, credited);
    }
}


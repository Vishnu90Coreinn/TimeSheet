using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class ProjectBudgetRepository(TimeSheetDbContext dbContext) : IProjectBudgetRepository
{
    public async Task<IReadOnlyList<ProjectBudgetHealthRow>> GetBudgetHealthAsync(CancellationToken ct = default)
    {
        var projects = await dbContext.Projects.AsNoTracking()
            .Where(p => p.IsActive && !p.IsArchived)
            .Select(p => new { p.Id, p.Name, p.Code, p.BudgetedHours })
            .ToListAsync(ct);

        if (projects.Count == 0) return Array.Empty<ProjectBudgetHealthRow>();

        var projectIds = projects.Select(p => p.Id).ToList();
        var minutesByProject = await dbContext.TimesheetEntries.AsNoTracking()
            .Where(e => projectIds.Contains(e.ProjectId))
            .GroupBy(e => e.ProjectId)
            .Select(g => new { ProjectId = g.Key, TotalMinutes = g.Sum(e => (long)e.Minutes) })
            .ToDictionaryAsync(x => x.ProjectId, x => x.TotalMinutes, ct);

        return projects.Select(p =>
        {
            minutesByProject.TryGetValue(p.Id, out var totalMinutes);
            var loggedHours = totalMinutes / 60.0;
            var pctUsed = p.BudgetedHours > 0 ? loggedHours / p.BudgetedHours * 100.0 : 0;
            var status = p.BudgetedHours == 0
                ? "no-budget"
                : pctUsed >= 100 ? "over-budget"
                : pctUsed >= 95 ? "critical"
                : pctUsed >= 80 ? "warning"
                : "on-track";
            return new ProjectBudgetHealthRow(p.Id, p.Name, p.Code, p.BudgetedHours, Math.Round(loggedHours, 2), Math.Round(pctUsed, 1), status);
        }).ToList();
    }

    public async Task<ProjectBudgetSummaryRow?> GetBudgetSummaryAsync(Guid projectId, CancellationToken ct = default)
    {
        var project = await dbContext.Projects.AsNoTracking()
            .Select(p => new { p.Id, p.Name, p.BudgetedHours })
            .SingleOrDefaultAsync(p => p.Id == projectId, ct);
        if (project is null) return null;

        var entries = await dbContext.TimesheetEntries.AsNoTracking()
            .Where(e => e.ProjectId == projectId)
            .Select(e => new { e.Minutes, e.Timesheet.WorkDate })
            .ToListAsync(ct);

        var totalMinutes = entries.Sum(e => (double)e.Minutes);
        var loggedHours = totalMinutes / 60.0;
        var remainingHours = Math.Max(0, project.BudgetedHours - loggedHours);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var thisWeekMonday = IsoWeekMonday(today);
        var weekStarts = Enumerable.Range(1, 8).Select(i => thisWeekMonday.AddDays(-7 * i)).OrderBy(d => d).ToList();
        var hoursByWeek = entries.GroupBy(e => IsoWeekMonday(e.WorkDate)).ToDictionary(g => g.Key, g => g.Sum(e => e.Minutes) / 60.0);
        var weeklyBreakdown = weekStarts
            .Select(ws => new WeeklyBurnRow(ws.ToString("yyyy-MM-dd"), hoursByWeek.TryGetValue(ws, out var h) ? Math.Round(h, 2) : 0.0))
            .ToList();
        var last4 = weekStarts.TakeLast(4).Where(ws => hoursByWeek.ContainsKey(ws) && hoursByWeek[ws] > 0).ToList();
        var burnRate = last4.Count > 0 ? last4.Average(ws => hoursByWeek[ws]) : 0.0;
        var projectedWeeks = burnRate > 0 ? (double?)Math.Round(remainingHours / burnRate, 1) : null;
        return new ProjectBudgetSummaryRow(project.Id, project.Name, project.BudgetedHours, Math.Round(loggedHours, 2), Math.Round(remainingHours, 2), Math.Round(burnRate, 2), projectedWeeks, weeklyBreakdown);
    }

    private static DateOnly IsoWeekMonday(DateOnly date)
    {
        var dow = (int)date.DayOfWeek;
        var daysFromMonday = dow == 0 ? 6 : dow - 1;
        return date.AddDays(-daysFromMonday);
    }
}

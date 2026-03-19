using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.ProjectBudget;

namespace TimeSheet.Api.Application.ProjectBudget.Services;

public class ProjectBudgetService(IProjectBudgetRepository repository) : IProjectBudgetService
{
    public async Task<(IReadOnlyList<ProjectBudgetHealthItem>? Data, OperationError? Error)> GetBudgetHealthAsync(CancellationToken cancellationToken)
    {
        var projects = await repository.GetActiveProjectsAsync(cancellationToken);
        if (projects.Count == 0)
        {
            return (Array.Empty<ProjectBudgetHealthItem>(), null);
        }

        var projectIds = projects.Select(p => p.Id).ToList();
        var minutesMap = await repository.GetTotalMinutesByProjectAsync(projectIds, cancellationToken);

        var result = projects.Select(p =>
        {
            minutesMap.TryGetValue(p.Id, out var totalMinutes);
            double loggedHours = totalMinutes / 60.0;
            double pctUsed = p.BudgetedHours > 0 ? loggedHours / p.BudgetedHours * 100.0 : 0;
            string status = p.BudgetedHours == 0
                ? "no-budget"
                : pctUsed >= 100 ? "over-budget"
                : pctUsed >= 95 ? "critical"
                : pctUsed >= 80 ? "warning"
                : "on-track";

            return new ProjectBudgetHealthItem(p.Id, p.Name, p.Code, p.BudgetedHours,
                Math.Round(loggedHours, 2), Math.Round(pctUsed, 1), status);
        }).ToList();

        return (result, null);
    }

    public async Task<(ProjectBudgetSummaryResponse? Data, OperationError? Error)> GetBudgetSummaryAsync(Guid id, CancellationToken cancellationToken)
    {
        var project = await repository.GetProjectForSummaryAsync(id, cancellationToken);
        if (project is null)
        {
            return (null, new OperationError(ErrorCodes.ProjectNotFound, ApiMessages.ProjectNotFound, StatusCodes.Status404NotFound));
        }

        var entries = await repository.GetProjectEntriesForSummaryAsync(id, cancellationToken);
        double totalMinutes = entries.Sum(e => (double)e.Minutes);
        double loggedHours = totalMinutes / 60.0;
        double remainingHours = Math.Max(0, project.Value.BudgetedHours - loggedHours);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var thisWeekMonday = IsoWeekMonday(today);
        var weekStarts = Enumerable.Range(1, 8).Select(i => thisWeekMonday.AddDays(-7 * i)).OrderBy(d => d).ToList();

        var hoursByWeek = entries
            .GroupBy(e => IsoWeekMonday(e.WorkDate))
            .ToDictionary(g => g.Key, g => g.Sum(e => e.Minutes) / 60.0);

        var weeklyBreakdown = weekStarts
            .Select(ws => new WeeklyBurnEntry(ws.ToString("yyyy-MM-dd"), hoursByWeek.TryGetValue(ws, out var h) ? Math.Round(h, 2) : 0.0))
            .ToList();

        var last4WeekStarts = weekStarts.TakeLast(4).ToList();
        var weeksWithData = last4WeekStarts.Where(ws => hoursByWeek.ContainsKey(ws) && hoursByWeek[ws] > 0).ToList();

        double burnRate = weeksWithData.Count > 0 ? weeksWithData.Average(ws => hoursByWeek[ws]) : 0.0;
        double? projectedWeeksRemaining = burnRate > 0 ? Math.Round(remainingHours / burnRate, 1) : null;

        return (new ProjectBudgetSummaryResponse(
            project.Value.Id,
            project.Value.Name,
            project.Value.BudgetedHours,
            Math.Round(loggedHours, 2),
            Math.Round(remainingHours, 2),
            Math.Round(burnRate, 2),
            projectedWeeksRemaining,
            weeklyBreakdown), null);
    }

    private static DateOnly IsoWeekMonday(DateOnly date)
    {
        int dow = (int)date.DayOfWeek;
        int daysFromMonday = dow == 0 ? 6 : dow - 1;
        return date.AddDays(-daysFromMonday);
    }
}

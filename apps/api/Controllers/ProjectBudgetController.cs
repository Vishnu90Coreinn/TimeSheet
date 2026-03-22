using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "manager,admin")]
[Route("api/v1/projects")]
public class ProjectBudgetController(TimeSheetDbContext dbContext) : ControllerBase
{
    // Returns the Monday (start) of the ISO week containing the given DateOnly.
    private static DateOnly IsoWeekMonday(DateOnly date)
    {
        int dow = (int)date.DayOfWeek; // Sunday=0, Monday=1 … Saturday=6
        int daysFromMonday = dow == 0 ? 6 : dow - 1;
        return date.AddDays(-daysFromMonday);
    }

    [HttpGet("budget-health")]
    public async Task<ActionResult<IEnumerable<ProjectBudgetHealthItem>>> GetBudgetHealth()
    {
        var projects = await dbContext.Projects
            .AsNoTracking()
            .Where(p => p.IsActive && !p.IsArchived)
            .Select(p => new { p.Id, p.Name, p.Code, p.BudgetedHours })
            .ToListAsync();

        if (projects.Count == 0)
            return Ok(Array.Empty<ProjectBudgetHealthItem>());

        var projectIds = projects.Select(p => p.Id).ToList();

        // Sum all minutes per project (all time — to compute overall logged hours)
        var minutesByProject = await dbContext.TimesheetEntries
            .AsNoTracking()
            .Where(e => projectIds.Contains(e.ProjectId))
            .GroupBy(e => e.ProjectId)
            .Select(g => new { ProjectId = g.Key, TotalMinutes = g.Sum(e => (long)e.Minutes) })
            .ToListAsync();

        var minutesMap = minutesByProject.ToDictionary(x => x.ProjectId, x => x.TotalMinutes);

        var result = projects.Select(p =>
        {
            minutesMap.TryGetValue(p.Id, out var totalMinutes);
            double loggedHours = totalMinutes / 60.0;
            double pctUsed = p.BudgetedHours > 0 ? loggedHours / p.BudgetedHours * 100.0 : 0;
            string status = p.BudgetedHours == 0
                ? "no-budget"
                : pctUsed >= 100 ? "over-budget"
                : pctUsed >= 95  ? "critical"
                : pctUsed >= 80  ? "warning"
                : "on-track";

            return new ProjectBudgetHealthItem(p.Id, p.Name, p.Code, p.BudgetedHours,
                Math.Round(loggedHours, 2), Math.Round(pctUsed, 1), status);
        }).ToList();

        return Ok(result);
    }

    [Authorize]
    [HttpGet("{id:guid}/budget-summary")]
    public async Task<ActionResult<ProjectBudgetSummaryResponse>> GetBudgetSummary(Guid id)
    {
        var project = await dbContext.Projects
            .AsNoTracking()
            .Select(p => new { p.Id, p.Name, p.BudgetedHours })
            .SingleOrDefaultAsync(p => p.Id == id);

        if (project is null)
            return NotFound();

        // Fetch all entries for this project, with the associated WorkDate from Timesheet
        var entries = await dbContext.TimesheetEntries
            .AsNoTracking()
            .Where(e => e.ProjectId == id)
            .Select(e => new { e.Minutes, e.Timesheet.WorkDate })
            .ToListAsync();

        double totalMinutes = entries.Sum(e => (double)e.Minutes);
        double loggedHours = totalMinutes / 60.0;
        double remainingHours = Math.Max(0, project.BudgetedHours - loggedHours);

        // Build weekly breakdown — last 8 completed ISO weeks (Mon–Sun)
        // "Completed" means the week ended before today.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var thisWeekMonday = IsoWeekMonday(today);

        // Build list of 8 week-Monday dates going backwards from last completed week
        var weekStarts = Enumerable.Range(1, 8)
            .Select(i => thisWeekMonday.AddDays(-7 * i))
            .OrderBy(d => d)
            .ToList();

        // Group entries by their ISO week Monday
        var hoursByWeek = entries
            .GroupBy(e => IsoWeekMonday(e.WorkDate))
            .ToDictionary(g => g.Key, g => g.Sum(e => e.Minutes) / 60.0);

        var weeklyBreakdown = weekStarts
            .Select(ws => new WeeklyBurnEntry(
                ws.ToString("yyyy-MM-dd"),
                hoursByWeek.TryGetValue(ws, out var h) ? Math.Round(h, 2) : 0.0
            ))
            .ToList();

        // Burn rate: average over last 4 weeks that had any entries
        var last4WeekStarts = weekStarts.TakeLast(4).ToList();
        var weeksWithData = last4WeekStarts
            .Where(ws => hoursByWeek.ContainsKey(ws) && hoursByWeek[ws] > 0)
            .ToList();

        double burnRate = weeksWithData.Count > 0
            ? weeksWithData.Average(ws => hoursByWeek[ws])
            : 0.0;

        double? projectedWeeksRemaining = burnRate > 0
            ? Math.Round(remainingHours / burnRate, 1)
            : null;

        return Ok(new ProjectBudgetSummaryResponse(
            project.Id,
            project.Name,
            project.BudgetedHours,
            Math.Round(loggedHours, 2),
            Math.Round(remainingHours, 2),
            Math.Round(burnRate, 2),
            projectedWeeksRemaining,
            weeklyBreakdown
        ));
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "manager,admin")]
[Route("api/v1/capacity")]
public class CapacityController(TimeSheetDbContext db) : ControllerBase
{
    // ── helpers ──────────────────────────────────────────────────────────────

    private static DateOnly GetMonday(DateOnly date)
    {
        int diff = (int)date.DayOfWeek - (int)DayOfWeek.Monday;
        if (diff < 0) diff += 7;
        return date.AddDays(-diff);
    }

    private static double AvailableHours(WorkPolicy? policy)
        => policy is null
            ? 40.0
            : policy.WorkDaysPerWeek * (policy.DailyExpectedMinutes / 60.0);

    // ── GET /api/v1/capacity/team ─────────────────────────────────────────────

    [HttpGet("team")]
    public async Task<ActionResult<CapacityTeamResponse>> GetTeamCapacity(
        [FromQuery] string? weekStart,
        [FromQuery] int weeks = 4,
        CancellationToken ct = default)
    {
        weeks = Math.Clamp(weeks, 1, 12);

        DateOnly firstMonday;
        if (!string.IsNullOrWhiteSpace(weekStart) && DateOnly.TryParseExact(weekStart, "yyyy-MM-dd", out var parsed))
            firstMonday = GetMonday(parsed);
        else
            firstMonday = GetMonday(DateOnly.FromDateTime(DateTime.UtcNow));

        // Build list of week starts
        var weekStarts = Enumerable.Range(0, weeks)
            .Select(i => firstMonday.AddDays(i * 7))
            .ToList();

        DateOnly rangeStart = weekStarts[0];
        DateOnly rangeEnd = weekStarts[^1].AddDays(6); // inclusive Sunday of last week

        // Fetch all active users with their work policies
        var users = await db.Users
            .Where(u => u.IsActive)
            .Include(u => u.WorkPolicy)
            .OrderBy(u => u.Username)
            .AsNoTracking()
            .ToListAsync(ct);

        var userIds = users.Select(u => u.Id).ToList();

        // Fetch timesheets with entries in the date range
        var timesheets = await db.Timesheets
            .Where(t => userIds.Contains(t.UserId)
                        && t.WorkDate >= rangeStart
                        && t.WorkDate <= rangeEnd)
            .Include(t => t.Entries)
            .AsNoTracking()
            .ToListAsync(ct);

        // Group logged minutes: userId -> weekStart -> minutes
        var minutesByUserWeek = timesheets
            .GroupBy(t => t.UserId)
            .ToDictionary(
                g => g.Key,
                g => g.GroupBy(t => GetMonday(t.WorkDate))
                       .ToDictionary(wg => wg.Key, wg => wg.SelectMany(t => t.Entries).Sum(e => e.Minutes))
            );

        var rows = users.Select(user =>
        {
            var availHours = AvailableHours(user.WorkPolicy);
            var weekCells = weekStarts.Select(ws =>
            {
                var minutes = minutesByUserWeek.TryGetValue(user.Id, out var byWeek)
                    && byWeek.TryGetValue(ws, out var m) ? m : 0;
                var loggedHours = Math.Round(minutes / 60.0, 2);
                var pct = availHours > 0 ? (int)Math.Round(loggedHours / availHours * 100) : 0;
                return new CapacityWeekCell(ws.ToString("yyyy-MM-dd"), loggedHours, pct);
            }).ToList();

            return new CapacityTeamRow(
                user.Id,
                user.Username,
                user.DisplayName,
                availHours,
                weekCells);
        }).ToList();

        var response = new CapacityTeamResponse(
            weekStarts.Select(ws => ws.ToString("yyyy-MM-dd")).ToList(),
            rows);

        return Ok(response);
    }

    // ── GET /api/v1/capacity/projects ─────────────────────────────────────────

    [HttpGet("projects")]
    public async Task<ActionResult<IReadOnlyList<CapacityProjectItem>>> GetProjectCapacity(
        [FromQuery] string? month,
        CancellationToken ct = default)
    {
        DateOnly monthStart;
        if (!string.IsNullOrWhiteSpace(month) && DateOnly.TryParseExact(month, "yyyy-MM", out var parsedMonth))
            monthStart = parsedMonth;
        else
        {
            var now = DateTime.UtcNow;
            monthStart = new DateOnly(now.Year, now.Month, 1);
        }
        DateOnly monthEnd = monthStart.AddMonths(1).AddDays(-1);

        // Fetch all active projects
        var projects = await db.Projects
            .Where(p => p.IsActive && !p.IsArchived)
            .AsNoTracking()
            .ToListAsync(ct);

        var projectIds = projects.Select(p => p.Id).ToHashSet();

        // Fetch timesheets with entries in the month
        var entries = await db.TimesheetEntries
            .Where(e => projectIds.Contains(e.ProjectId)
                        && e.Timesheet.WorkDate >= monthStart
                        && e.Timesheet.WorkDate <= monthEnd)
            .Include(e => e.Timesheet)
                .ThenInclude(t => t.User)
            .AsNoTracking()
            .ToListAsync(ct);

        // Build per-project totals and per-user-project breakdown
        var projectMap = projects.ToDictionary(p => p.Id);

        var grouped = entries
            .GroupBy(e => e.ProjectId)
            .Select(pg =>
            {
                var proj = projectMap[pg.Key];
                var totalMinutes = pg.Sum(e => e.Minutes);
                var loggedHours = Math.Round(totalMinutes / 60.0, 2);
                var budgetedHours = (double)proj.BudgetedHours;
                var pct = budgetedHours > 0 ? (int)Math.Round(loggedHours / budgetedHours * 100) : 0;

                var contributions = pg
                    .GroupBy(e => new { e.Timesheet.UserId, e.Timesheet.User.Username })
                    .Select(ug => new CapacityProjectContribution(
                        ug.Key.UserId,
                        ug.Key.Username,
                        Math.Round(ug.Sum(e => e.Minutes) / 60.0, 2)))
                    .OrderByDescending(c => c.LoggedHours)
                    .ToList();

                return new CapacityProjectItem(
                    proj.Id,
                    proj.Name,
                    budgetedHours,
                    loggedHours,
                    pct,
                    contributions);
            })
            .ToList();

        // Include active projects with 0 hours (not in grouped)
        var coveredIds = grouped.Select(g => g.ProjectId).ToHashSet();
        var zeroProjects = projects
            .Where(p => !coveredIds.Contains(p.Id))
            .Select(p => new CapacityProjectItem(
                p.Id,
                p.Name,
                (double)p.BudgetedHours,
                0.0,
                0,
                Array.Empty<CapacityProjectContribution>()))
            .ToList();

        var result = grouped
            .Concat(zeroProjects)
            .OrderByDescending(p => p.LoggedHours)
            .ToList();

        return Ok(result);
    }

    // ── GET /api/v1/capacity/overallocated ────────────────────────────────────

    [HttpGet("overallocated")]
    public async Task<ActionResult<IReadOnlyList<OverallocatedUser>>> GetOverallocated(
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var weekMonday = GetMonday(today);
        var weekSunday = weekMonday.AddDays(6);

        // Fetch all active users with work policies
        var users = await db.Users
            .Where(u => u.IsActive)
            .Include(u => u.WorkPolicy)
            .AsNoTracking()
            .ToListAsync(ct);

        var userIds = users.Select(u => u.Id).ToList();

        // Fetch timesheets with entries for current week
        var timesheets = await db.Timesheets
            .Where(t => userIds.Contains(t.UserId)
                        && t.WorkDate >= weekMonday
                        && t.WorkDate <= weekSunday)
            .Include(t => t.Entries)
            .AsNoTracking()
            .ToListAsync(ct);

        var minutesByUser = timesheets
            .GroupBy(t => t.UserId)
            .ToDictionary(g => g.Key, g => g.SelectMany(t => t.Entries).Sum(e => e.Minutes));

        var overallocated = users
            .Select(user =>
            {
                var availHours = AvailableHours(user.WorkPolicy);
                var minutes = minutesByUser.TryGetValue(user.Id, out var m) ? m : 0;
                var loggedHours = Math.Round(minutes / 60.0, 2);
                var pct = availHours > 0 ? (int)Math.Round(loggedHours / availHours * 100) : 0;
                return (user, availHours, loggedHours, pct);
            })
            .Where(x => x.loggedHours > x.availHours)
            .OrderByDescending(x => x.pct)
            .Select(x => new OverallocatedUser(
                x.user.Id,
                x.user.Username,
                x.user.DisplayName,
                x.availHours,
                x.loggedHours,
                x.pct))
            .ToList();

        return Ok(overallocated);
    }
}

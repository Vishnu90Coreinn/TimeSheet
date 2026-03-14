using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/dashboard")]
public class DashboardController(TimeSheetDbContext dbContext) : ControllerBase
{
    [HttpGet("employee")]
    public async Task<IActionResult> Employee()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var weekStart = StartOfWeek(today);

        var todaySession = await dbContext.WorkSessions.AsNoTracking().Where(x => x.UserId == userId && x.WorkDate == today)
            .Select(x => new
            {
                x.WorkDate,
                CheckedIn = (DateTime?)x.CheckInAtUtc,
                CheckedOut = x.CheckOutAtUtc,
                BreakMinutes = x.Breaks.Sum(b => b.DurationMinutes),
                AttendanceMinutes = (x.CheckOutAtUtc.HasValue ? (int)(x.CheckOutAtUtc.Value - x.CheckInAtUtc).TotalMinutes : 0) - x.Breaks.Sum(b => b.DurationMinutes)
            })
            .FirstOrDefaultAsync();

        var todayTimesheet = await dbContext.Timesheets.AsNoTracking().Where(x => x.UserId == userId && x.WorkDate == today)
            .Select(x => new
            {
                x.Status,
                x.MismatchReason,
                EnteredMinutes = x.Entries.Sum(e => e.Minutes),
                PendingActions = x.Status == TimesheetStatus.Draft ? 1 : 0
            })
            .FirstOrDefaultAsync();

        var weeklyHours = await dbContext.Timesheets.AsNoTracking().Where(x => x.UserId == userId && x.WorkDate >= weekStart && x.WorkDate <= weekStart.AddDays(6))
            .GroupBy(_ => 1)
            .Select(g => new { Entered = g.Sum(x => x.Entries.Sum(e => e.Minutes)), Breaks = dbContext.WorkSessions.Where(ws => ws.UserId == userId && ws.WorkDate >= weekStart && ws.WorkDate <= weekStart.AddDays(6)).Sum(ws => ws.Breaks.Sum(b => b.DurationMinutes)) })
            .FirstOrDefaultAsync();

        var projectEffortRows = await dbContext.TimesheetEntries.AsNoTracking().Where(x => x.Timesheet.UserId == userId && x.Timesheet.WorkDate >= weekStart && x.Timesheet.WorkDate <= weekStart.AddDays(6))
            .GroupBy(x => x.Project.Name)
            .Select(g => new { Project = g.Key, Minutes = g.Sum(x => x.Minutes) })
            .OrderByDescending(x => x.Minutes)
            .ToListAsync();
        var projectEffort = projectEffortRows.Select(x => (object)x).ToList();

        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var monthlyComplianceTrendRows = await dbContext.Timesheets.AsNoTracking().Where(x => x.UserId == userId && x.WorkDate >= monthStart)
            .GroupBy(x => x.WorkDate)
            .Select(g => new { WorkDate = g.Key, IsCompliant = g.All(x => x.Status == TimesheetStatus.Approved || x.Status == TimesheetStatus.Submitted) })
            .OrderBy(x => x.WorkDate)
            .ToListAsync();
        var monthlyComplianceTrend = monthlyComplianceTrendRows.Select(x => (object)x).ToList();

        return Ok(new EmployeeDashboardResponse(
            todaySession ?? new { WorkDate = today, CheckedIn = (DateTime?)null, CheckedOut = (DateTime?)null, BreakMinutes = 0, AttendanceMinutes = 0 },
            todayTimesheet ?? new { Status = TimesheetStatus.Draft, MismatchReason = (string?)null, EnteredMinutes = 0, PendingActions = 1 },
            weeklyHours ?? new { Entered = 0, Breaks = 0 },
            projectEffort,
            monthlyComplianceTrend));
    }

    [HttpGet("manager")]
    public async Task<IActionResult> Manager()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var teamIds = await dbContext.Users.AsNoTracking().Where(x => x.ManagerId == userId).Select(x => x.Id).ToListAsync();
        if (teamIds.Count == 0) return Ok(new ManagerDashboardResponse(new { Present = 0, OnLeave = 0, NotCheckedIn = 0 }, new { Missing = 0, PendingApprovals = 0 }, [], new { AvgMinutes = 0 }, []));

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var present = await dbContext.WorkSessions.CountAsync(x => teamIds.Contains(x.UserId) && x.WorkDate == today);
        var onLeave = await dbContext.LeaveRequests.CountAsync(x => teamIds.Contains(x.UserId) && x.LeaveDate == today && x.Status == LeaveRequestStatus.Approved);
        var notCheckedIn = Math.Max(0, teamIds.Count - present - onLeave);

        var missing = await dbContext.Users.CountAsync(x => teamIds.Contains(x.Id) && !x.Timesheets.Any(t => t.WorkDate == today));
        var pendingApprovals = await dbContext.Timesheets.CountAsync(x => teamIds.Contains(x.UserId) && x.Status == TimesheetStatus.Submitted);

        var mismatchRows = await dbContext.Timesheets.AsNoTracking().Where(x => teamIds.Contains(x.UserId) && !string.IsNullOrWhiteSpace(x.MismatchReason))
            .OrderByDescending(x => x.WorkDate)
            .Take(10)
            .Select(x => new { x.User.Username, x.WorkDate, x.MismatchReason })
            .ToListAsync();
        var mismatches = mismatchRows.Select(x => (object)x).ToList();

        var utilization = await dbContext.Timesheets.AsNoTracking().Where(x => teamIds.Contains(x.UserId) && x.WorkDate >= today.AddDays(-7))
            .GroupBy(_ => 1)
            .Select(g => new { AvgMinutes = g.Average(x => x.Entries.Sum(e => e.Minutes)) })
            .FirstOrDefaultAsync();

        var contributionRows = await dbContext.TimesheetEntries.AsNoTracking().Where(x => teamIds.Contains(x.Timesheet.UserId) && x.Timesheet.WorkDate >= today.AddDays(-7))
            .GroupBy(x => x.Project.Name)
            .Select(g => new { Project = g.Key, Minutes = g.Sum(x => x.Minutes) })
            .OrderByDescending(x => x.Minutes)
            .Take(10)
            .ToListAsync();
        var contributions = contributionRows.Select(x => (object)x).ToList();

        return Ok(new ManagerDashboardResponse(
            new { Present = present, OnLeave = onLeave, NotCheckedIn = notCheckedIn },
            new { Missing = missing, PendingApprovals = pendingApprovals },
            mismatches,
            utilization ?? new { AvgMinutes = 0d },
            contributions));
    }

    [HttpGet("management")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Management()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var fromDate = today.AddDays(-30);

        var effortByDepartmentRows = await dbContext.TimesheetEntries.AsNoTracking().Where(x => x.Timesheet.WorkDate >= fromDate)
            .GroupBy(x => x.Timesheet.User.Department != null ? x.Timesheet.User.Department.Name : "Unassigned")
            .Select(g => new { Department = g.Key, Minutes = g.Sum(x => x.Minutes) })
            .ToListAsync();
        var effortByDepartment = effortByDepartmentRows.Select(x => (object)x).ToList();

        var effortByProjectRows = await dbContext.TimesheetEntries.AsNoTracking().Where(x => x.Timesheet.WorkDate >= fromDate)
            .GroupBy(x => x.Project.Name)
            .Select(g => new { Project = g.Key, Minutes = g.Sum(x => x.Minutes) })
            .ToListAsync();
        var effortByProject = effortByProjectRows.Select(x => (object)x).ToList();

        var billableCategoryIds = await dbContext.TaskCategories.Where(c => c.IsBillable).Select(c => c.Id).ToListAsync();
        var billableMinutes = await dbContext.TimesheetEntries.Where(x => billableCategoryIds.Contains(x.TaskCategoryId) && x.Timesheet.WorkDate >= fromDate).SumAsync(x => x.Minutes);
        var totalMinutes = await dbContext.TimesheetEntries.Where(x => x.Timesheet.WorkDate >= fromDate).SumAsync(x => x.Minutes);

        var consultantVsInternal = new
        {
            Consultant = await dbContext.Users.CountAsync(x => x.Email.EndsWith("@consultant.local")),
            Internal = await dbContext.Users.CountAsync(x => !x.Email.EndsWith("@consultant.local"))
        };

        var userLoad = await dbContext.Users.AsNoTracking()
            .Where(x => x.IsActive)
            .Select(x => new
            {
                x.Username,
                Minutes = x.Timesheets.Where(t => t.WorkDate >= fromDate).Sum(t => t.Entries.Sum(e => e.Minutes))
            }).ToListAsync();
        var underOver = userLoad.Select(x => (object)new { x.Username, Status = x.Minutes < 8 * 60 * 10 ? "underutilized" : x.Minutes > 8 * 60 * 25 ? "overloaded" : "balanced", x.Minutes }).ToList();

        var complianceRows = await dbContext.Timesheets.AsNoTracking().Where(x => x.WorkDate >= fromDate)
            .GroupBy(x => x.WorkDate)
            .Select(g => new
            {
                WorkDate = g.Key,
                Missing = dbContext.Users.Count(u => u.IsActive) - g.Select(x => x.UserId).Distinct().Count(),
                Overtime = g.Count(x => x.Entries.Sum(e => e.Minutes) > 8 * 60),
                NonCompliant = g.Count(x => x.Status == TimesheetStatus.Draft || x.Status == TimesheetStatus.Rejected)
            })
            .ToListAsync();
        var compliance = complianceRows.Select(x => (object)x).ToList();

        return Ok(new ManagementDashboardResponse(
            effortByDepartment,
            effortByProject,
            new { BillableMinutes = billableMinutes, NonBillableMinutes = Math.Max(0, totalMinutes - billableMinutes) },
            consultantVsInternal,
            underOver,
            compliance));
    }

    private Guid? GetUserId()
    {
        var rawUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(rawUserId, out var userId) ? userId : null;
    }

    private static DateOnly StartOfWeek(DateOnly value)
    {
        var diff = ((int)value.DayOfWeek + 6) % 7;
        return value.AddDays(-diff);
    }
}

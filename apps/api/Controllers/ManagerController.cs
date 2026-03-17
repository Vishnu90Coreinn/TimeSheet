using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;
using TimeSheet.Api.Services;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "manager,admin")]
[Route("api/v1/manager")]
public class ManagerController(TimeSheetDbContext dbContext, INotificationService notificationService) : ControllerBase
{
    private Guid? GetUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    // ── GET /manager/team-status?date=YYYY-MM-DD ─────────────────────────────

    [HttpGet("team-status")]
    public async Task<ActionResult<IReadOnlyList<TeamMemberStatusResponse>>> GetTeamStatus(
        [FromQuery] DateOnly? date = null)
    {
        var managerId = GetUserId();
        if (managerId is null) return Unauthorized();

        var effectiveDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);

        // Monday of the requested week
        var weekStart = StartOfWeek(effectiveDate);
        var weekEnd   = weekStart.AddDays(6);

        // Direct reports of this manager
        var directReports = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.ManagerId == managerId.Value && u.IsActive)
            .Select(u => new { u.Id, u.Username, u.DisplayName, u.AvatarDataUrl, u.WorkPolicyId })
            .ToListAsync();

        if (directReports.Count == 0)
            return Ok(Array.Empty<TeamMemberStatusResponse>());

        var reportIds = directReports.Select(u => u.Id).ToList();

        // Batch load all needed data in parallel
        var sessionsTask = dbContext.WorkSessions
            .AsNoTracking()
            .Where(ws => reportIds.Contains(ws.UserId) && ws.WorkDate == effectiveDate)
            .ToListAsync();

        var weekTimesheetsTask = dbContext.Timesheets
            .AsNoTracking()
            .Where(t => reportIds.Contains(t.UserId) && t.WorkDate >= weekStart && t.WorkDate <= weekEnd)
            .Select(t => new { t.UserId, t.WorkDate, t.Status, EntriesMinutes = t.Entries.Sum(e => e.Minutes) })
            .ToListAsync();

        var leavesTask = dbContext.LeaveRequests
            .AsNoTracking()
            .Where(l => reportIds.Contains(l.UserId) && l.LeaveDate == effectiveDate && l.Status == LeaveRequestStatus.Approved)
            .Select(l => l.UserId)
            .ToListAsync();

        var pendingApprovalsTask = dbContext.Timesheets
            .AsNoTracking()
            .Where(t => reportIds.Contains(t.UserId) && t.Status == TimesheetStatus.Submitted)
            .GroupBy(t => t.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToListAsync();

        var workPoliciesTask = dbContext.WorkPolicies
            .AsNoTracking()
            .Select(wp => new { wp.Id, wp.DailyExpectedMinutes, wp.WorkDaysPerWeek })
            .ToListAsync();

        await Task.WhenAll(sessionsTask, weekTimesheetsTask, leavesTask, pendingApprovalsTask, workPoliciesTask);

        var sessions         = sessionsTask.Result;
        var weekTimesheets   = weekTimesheetsTask.Result;
        var onLeaveUserIds   = leavesTask.Result.ToHashSet();
        var pendingByUser    = pendingApprovalsTask.Result.ToDictionary(x => x.UserId, x => x.Count);
        var workPolicies     = workPoliciesTask.Result.ToDictionary(wp => wp.Id);

        var result = directReports.Select(u =>
        {
            // Attendance
            var todaySessions = sessions.Where(ws => ws.UserId == u.Id).ToList();
            var activeSession = todaySessions.FirstOrDefault(ws => ws.Status == WorkSessionStatus.Active);
            var completedSession = todaySessions.OrderByDescending(ws => ws.CheckOutAtUtc).FirstOrDefault(ws => ws.Status == WorkSessionStatus.Completed);

            string attendance;
            string? checkInTime  = null;
            string? checkOutTime = null;

            if (onLeaveUserIds.Contains(u.Id))
            {
                attendance = "onLeave";
            }
            else if (activeSession is not null)
            {
                attendance  = "checkedIn";
                checkInTime = activeSession.CheckInAtUtc.ToString("HH:mm");
            }
            else if (completedSession is not null)
            {
                attendance   = "checkedOut";
                checkInTime  = completedSession.CheckInAtUtc.ToString("HH:mm");
                checkOutTime = completedSession.CheckOutAtUtc?.ToString("HH:mm");
            }
            else
            {
                attendance = "absent";
            }

            // Week progress
            var userWeekTimesheets = weekTimesheets.Where(t => t.UserId == u.Id).ToList();
            var weekLogged = userWeekTimesheets.Sum(t => t.EntriesMinutes);

            int dailyExpected = 480;
            if (u.WorkPolicyId.HasValue && workPolicies.TryGetValue(u.WorkPolicyId.Value, out var wp))
                dailyExpected = wp.DailyExpectedMinutes;
            // Mon–Fri = 5 days (Sun has 0 expected)
            var weekExpected = dailyExpected * 5;

            // Today timesheet status
            var todayTs = userWeekTimesheets.FirstOrDefault(t => t.WorkDate == effectiveDate);
            string tsStatus;
            if (todayTs is null || todayTs.EntriesMinutes == 0)
                tsStatus = "missing";
            else
                tsStatus = todayTs.Status.ToString().ToLowerInvariant();

            return new TeamMemberStatusResponse(
                u.Id,
                u.Username,
                u.DisplayName,
                u.AvatarDataUrl,
                attendance,
                checkInTime,
                checkOutTime,
                weekLogged,
                weekExpected,
                tsStatus,
                pendingByUser.GetValueOrDefault(u.Id, 0)
            );
        }).ToList();

        return Ok(result);
    }

    // ── POST /manager/remind/{userId} ────────────────────────────────────────

    [HttpPost("remind/{userId:guid}")]
    public async Task<IActionResult> RemindUser(Guid userId)
    {
        var managerId = GetUserId();
        if (managerId is null) return Unauthorized();

        // Ensure the target is a direct report of this manager
        var isDirectReport = await dbContext.Users
            .AsNoTracking()
            .AnyAsync(u => u.Id == userId && u.ManagerId == managerId.Value && u.IsActive);

        if (!isDirectReport)
            return NotFound(new { message = "User not found among your direct reports." });

        await notificationService.CreateAsync(
            userId,
            "Timesheet Reminder",
            "Your manager has sent a reminder to submit your timesheet.",
            NotificationType.MissingTimesheet
        );

        return NoContent();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static DateOnly StartOfWeek(DateOnly date)
    {
        var diff = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-diff);
    }
}

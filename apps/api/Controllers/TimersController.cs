using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/timers")]
[Authorize]
public class TimersController(TimeSheetDbContext dbContext) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>GET /timers/active — returns running timer or 404.</summary>
    [HttpGet("active")]
    public async Task<IActionResult> GetActive()
    {
        var timer = await dbContext.TimerSessions
            .AsNoTracking()
            .Include(t => t.Project)
            .Include(t => t.Category)
            .Where(t => t.UserId == CurrentUserId && t.StoppedAtUtc == null)
            .FirstOrDefaultAsync();

        if (timer == null) return NotFound();
        return Ok(MapToResponse(timer));
    }

    /// <summary>POST /timers/start — starts a new timer; one active per user.</summary>
    [HttpPost("start")]
    public async Task<IActionResult> Start([FromBody] StartTimerRequest request)
    {
        var existing = await dbContext.TimerSessions
            .Where(t => t.UserId == CurrentUserId && t.StoppedAtUtc == null)
            .FirstOrDefaultAsync();

        if (existing != null)
            return Conflict(new { message = "A timer is already running. Stop it before starting a new one." });

        var project = await dbContext.Projects.FindAsync(request.ProjectId);
        if (project == null) return BadRequest(new { message = "Project not found." });

        var category = await dbContext.TaskCategories.FindAsync(request.CategoryId);
        if (category == null) return BadRequest(new { message = "Category not found." });

        var timer = new TimerSession
        {
            Id = Guid.NewGuid(),
            UserId = CurrentUserId,
            ProjectId = request.ProjectId,
            CategoryId = request.CategoryId,
            Note = request.Note?.Trim(),
            StartedAtUtc = DateTime.UtcNow,
        };

        dbContext.TimerSessions.Add(timer);
        await dbContext.SaveChangesAsync();

        timer.Project = project;
        timer.Category = category;
        return Ok(MapToResponse(timer));
    }

    /// <summary>POST /timers/stop — stops running timer and computes duration.</summary>
    [HttpPost("stop")]
    public async Task<IActionResult> Stop()
    {
        var timer = await dbContext.TimerSessions
            .Include(t => t.Project)
            .Include(t => t.Category)
            .Where(t => t.UserId == CurrentUserId && t.StoppedAtUtc == null)
            .FirstOrDefaultAsync();

        if (timer == null) return NotFound(new { message = "No active timer found." });

        timer.StoppedAtUtc = DateTime.UtcNow;
        timer.DurationMinutes = (int)Math.Max(1, Math.Round(
            (timer.StoppedAtUtc.Value - timer.StartedAtUtc).TotalMinutes));

        await dbContext.SaveChangesAsync();
        return Ok(MapToResponse(timer));
    }

    /// <summary>POST /timers/{id}/convert — creates a draft timesheet entry from a stopped timer.</summary>
    [HttpPost("{id:guid}/convert")]
    public async Task<IActionResult> Convert(Guid id, [FromBody] ConvertTimerRequest request)
    {
        var timer = await dbContext.TimerSessions
            .Where(t => t.Id == id && t.UserId == CurrentUserId)
            .FirstOrDefaultAsync();

        if (timer == null) return NotFound();
        if (timer.StoppedAtUtc == null)
            return BadRequest(new { message = "Timer must be stopped before converting." });
        if (timer.ConvertedToEntryId != null)
            return Conflict(new { message = "Timer has already been converted to an entry." });
        if (timer.DurationMinutes is null or < 1)
            return BadRequest(new { message = "Timer duration is invalid." });

        var timesheet = await dbContext.Timesheets
            .Where(ts => ts.UserId == CurrentUserId && ts.WorkDate == request.WorkDate)
            .FirstOrDefaultAsync();

        if (timesheet == null)
        {
            timesheet = new Timesheet
            {
                Id = Guid.NewGuid(),
                UserId = CurrentUserId,
                WorkDate = request.WorkDate,
                Status = TimesheetStatus.Draft,
            };
            dbContext.Timesheets.Add(timesheet);
            await dbContext.SaveChangesAsync();
        }
        else if (timesheet.Status != TimesheetStatus.Draft)
        {
            return BadRequest(new { message = "Cannot add entries to a submitted or approved timesheet." });
        }

        var entry = new TimesheetEntry
        {
            Id = Guid.NewGuid(),
            TimesheetId = timesheet.Id,
            ProjectId = timer.ProjectId,
            TaskCategoryId = timer.CategoryId,
            Minutes = timer.DurationMinutes.Value,
            Notes = timer.Note,
        };

        dbContext.TimesheetEntries.Add(entry);
        timer.ConvertedToEntryId = entry.Id;
        await dbContext.SaveChangesAsync();

        return Ok(new { entryId = entry.Id, timesheetId = timesheet.Id });
    }

    /// <summary>GET /timers/history?date=YYYY-MM-DD — timer sessions for a given day.</summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] DateOnly? date)
    {
        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var timers = await dbContext.TimerSessions
            .AsNoTracking()
            .Include(t => t.Project)
            .Include(t => t.Category)
            .Where(t => t.UserId == CurrentUserId &&
                        DateOnly.FromDateTime(t.StartedAtUtc) == targetDate)
            .OrderByDescending(t => t.StartedAtUtc)
            .ToListAsync();

        return Ok(timers.Select(MapToResponse));
    }

    private static TimerSessionResponse MapToResponse(TimerSession t) => new(
        t.Id,
        t.ProjectId,
        t.Project?.Name ?? "",
        t.CategoryId,
        t.Category?.Name ?? "",
        t.Note,
        DateTime.SpecifyKind(t.StartedAtUtc, DateTimeKind.Utc).ToString("O"),
        t.StoppedAtUtc.HasValue
            ? DateTime.SpecifyKind(t.StoppedAtUtc.Value, DateTimeKind.Utc).ToString("O")
            : null,
        t.DurationMinutes,
        t.ConvertedToEntryId);
}

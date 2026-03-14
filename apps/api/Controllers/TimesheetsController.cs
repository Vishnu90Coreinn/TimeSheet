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
[Authorize]
[Route("api/v1/timesheets")]
public class TimesheetsController(TimeSheetDbContext dbContext, IAttendanceCalculationService attendanceCalculationService) : ControllerBase
{
    [HttpGet("entry-options")]
    public async Task<IActionResult> GetEntryOptions()
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "employee";
        var projectsQuery = dbContext.Projects.AsNoTracking().Where(p => p.IsActive && !p.IsArchived);

        if (!string.Equals(userRole, "admin", StringComparison.OrdinalIgnoreCase))
        {
            projectsQuery = projectsQuery.Where(p => p.Members.Any(m => m.UserId == userId));
        }

        var projects = await projectsQuery
            .OrderBy(p => p.Name)
            .Select(p => new ProjectResponse(p.Id, p.Name, p.Code, p.IsActive, p.IsArchived))
            .ToListAsync();

        var categories = await dbContext.TaskCategories.AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new TaskCategoryResponse(c.Id, c.Name, c.IsActive))
            .ToListAsync();

        return Ok(new { projects, taskCategories = categories });
    }

    [HttpGet("day")]
    public async Task<IActionResult> GetDay([FromQuery] DateOnly? workDate = null)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var effectiveDate = workDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var dto = await BuildDayResponse(userId.Value, effectiveDate);
        return Ok(dto);
    }

    [HttpGet("daily-totals")]
    public async Task<IActionResult> GetDailyTotals([FromQuery] DateOnly? workDate = null)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var effectiveDate = workDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var dto = await BuildDayResponse(userId.Value, effectiveDate);

        return Ok(new
        {
            dto.WorkDate,
            dto.AttendanceNetMinutes,
            dto.EnteredMinutes,
            dto.RemainingMinutes,
            dto.HasMismatch,
            dto.MismatchReason
        });
    }

    [HttpGet("week")]
    public async Task<IActionResult> GetWeek([FromQuery] DateOnly? anyDateInWeek = null)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var anchor = anyDateInWeek ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var weekStart = StartOfWeek(anchor);
        var weekEnd = weekStart.AddDays(6);

        var days = new List<TimesheetWeekDayResponse>();
        for (var i = 0; i < 7; i++)
        {
            var day = weekStart.AddDays(i);
            var daySummary = await BuildDayResponse(userId.Value, day);
            days.Add(new TimesheetWeekDayResponse(
                day,
                daySummary.Status,
                daySummary.EnteredMinutes,
                daySummary.AttendanceNetMinutes,
                daySummary.HasMismatch));
        }

        return Ok(new TimesheetWeekResponse(
            weekStart,
            weekEnd,
            days.Sum(d => d.EnteredMinutes),
            days.Sum(d => d.AttendanceNetMinutes),
            days));
    }

    [HttpPost("entries")]
    public async Task<IActionResult> UpsertEntry([FromBody] UpsertTimesheetEntryRequest request)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var validation = await ValidateEditWindow(userId.Value, request.WorkDate);
        if (validation is not null)
        {
            return validation;
        }

        if (request.Minutes <= 0 || request.Minutes > 1440)
        {
            return BadRequest(new { message = "Minutes must be between 1 and 1440." });
        }

        var canWriteProject = await CanWriteProject(userId.Value, request.ProjectId);
        if (!canWriteProject)
        {
            return BadRequest(new { message = "Only active projects assigned to you can be used in timesheets." });
        }

        var hasCategory = await dbContext.TaskCategories.AnyAsync(c => c.Id == request.TaskCategoryId && c.IsActive);
        if (!hasCategory)
        {
            return BadRequest(new { message = "Only active task categories can be used in timesheets." });
        }

        var timesheet = await GetOrCreateDraftTimesheet(userId.Value, request.WorkDate);

        if (timesheet.Status != TimesheetStatus.Draft)
        {
            return Conflict(new { message = "Only draft timesheets can be edited." });
        }

        TimesheetEntry entry;
        if (request.EntryId is { } entryId)
        {
            entry = await dbContext.TimesheetEntries
                .Where(e => e.TimesheetId == timesheet.Id && e.Id == entryId)
                .SingleOrDefaultAsync() ?? new TimesheetEntry { Id = Guid.NewGuid(), TimesheetId = timesheet.Id };

            if (entry.Id == entryId)
            {
                entry.ProjectId = request.ProjectId;
                entry.TaskCategoryId = request.TaskCategoryId;
                entry.Minutes = request.Minutes;
                entry.Notes = request.Notes;
            }
            else
            {
                entry.ProjectId = request.ProjectId;
                entry.TaskCategoryId = request.TaskCategoryId;
                entry.Minutes = request.Minutes;
                entry.Notes = request.Notes;
                dbContext.TimesheetEntries.Add(entry);
            }
        }
        else
        {
            entry = new TimesheetEntry
            {
                Id = Guid.NewGuid(),
                TimesheetId = timesheet.Id,
                ProjectId = request.ProjectId,
                TaskCategoryId = request.TaskCategoryId,
                Minutes = request.Minutes,
                Notes = request.Notes
            };
            dbContext.TimesheetEntries.Add(entry);
        }

        await dbContext.SaveChangesAsync();
        return Ok(await BuildDayResponse(userId.Value, request.WorkDate));
    }

    [HttpDelete("entries/{entryId:guid}")]
    public async Task<IActionResult> DeleteEntry(Guid entryId)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var entry = await dbContext.TimesheetEntries
            .Include(e => e.Timesheet)
            .SingleOrDefaultAsync(e => e.Id == entryId && e.Timesheet.UserId == userId.Value);

        if (entry is null)
        {
            return NotFound();
        }

        var validation = await ValidateEditWindow(userId.Value, entry.Timesheet.WorkDate);
        if (validation is not null)
        {
            return validation;
        }

        if (entry.Timesheet.Status != TimesheetStatus.Draft)
        {
            return Conflict(new { message = "Only draft timesheets can be edited." });
        }

        dbContext.TimesheetEntries.Remove(entry);
        await dbContext.SaveChangesAsync();

        return Ok(await BuildDayResponse(userId.Value, entry.Timesheet.WorkDate));
    }

    [HttpPost("copy")]
    public async Task<IActionResult> CopyDay([FromBody] CopyTimesheetRequest request)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var validation = await ValidateEditWindow(userId.Value, request.TargetDate);
        if (validation is not null)
        {
            return validation;
        }

        var source = await dbContext.Timesheets
            .Include(t => t.Entries)
            .Where(t => t.UserId == userId.Value && t.WorkDate == request.SourceDate)
            .SingleOrDefaultAsync();

        if (source is null || source.Entries.Count == 0)
        {
            return BadRequest(new { message = "No source entries found for the source date." });
        }

        var target = await GetOrCreateDraftTimesheet(userId.Value, request.TargetDate);
        if (target.Status != TimesheetStatus.Draft)
        {
            return Conflict(new { message = "Only draft timesheets can be edited." });
        }

        var existing = await dbContext.TimesheetEntries.Where(e => e.TimesheetId == target.Id).ToListAsync();
        if (existing.Count > 0)
        {
            dbContext.TimesheetEntries.RemoveRange(existing);
        }

        dbContext.TimesheetEntries.AddRange(source.Entries.Select(e => new TimesheetEntry
        {
            Id = Guid.NewGuid(),
            TimesheetId = target.Id,
            ProjectId = e.ProjectId,
            TaskCategoryId = e.TaskCategoryId,
            Minutes = e.Minutes,
            Notes = e.Notes
        }));

        await dbContext.SaveChangesAsync();
        return Ok(await BuildDayResponse(userId.Value, request.TargetDate));
    }

    [HttpPost("submit")]
    public async Task<IActionResult> Submit([FromBody] SubmitTimesheetRequest request)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var isActive = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (bool?)u.IsActive)
            .SingleOrDefaultAsync();

        if (isActive is null)
        {
            return Unauthorized();
        }

        if (isActive is false)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Inactive users cannot submit timesheets." });
        }

        var validation = await ValidateEditWindow(userId.Value, request.WorkDate);
        if (validation is not null)
        {
            return validation;
        }

        var timesheet = await GetOrCreateDraftTimesheet(userId.Value, request.WorkDate);
        if (timesheet.Status != TimesheetStatus.Draft)
        {
            return Conflict(new { message = "Only draft timesheets can be submitted." });
        }

        var attendanceNet = await GetAttendanceNetMinutes(userId.Value, request.WorkDate);
        var entered = await dbContext.TimesheetEntries
            .Where(e => e.TimesheetId == timesheet.Id)
            .SumAsync(e => (int?)e.Minutes) ?? 0;

        var hasMismatch = attendanceNet != entered;
        var requiresMismatchReason = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId.Value)
            .Select(u => u.WorkPolicy != null && u.WorkPolicy.RequireMismatchReason)
            .SingleOrDefaultAsync();

        if (hasMismatch && requiresMismatchReason && string.IsNullOrWhiteSpace(request.MismatchReason))
        {
            return BadRequest(new { message = "Mismatch reason is required when entered and attendance minutes do not match." });
        }

        timesheet.SubmissionNotes = request.Notes;
        timesheet.MismatchReason = hasMismatch ? request.MismatchReason?.Trim() : null;
        timesheet.Status = TimesheetStatus.Submitted;
        timesheet.SubmittedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();
        return Ok(await BuildDayResponse(userId.Value, request.WorkDate));
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(sub, out var userId) ? userId : null;
    }

    private static DateOnly StartOfWeek(DateOnly date)
    {
        var diff = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-diff);
    }

    private async Task<Timesheet> GetOrCreateDraftTimesheet(Guid userId, DateOnly workDate)
    {
        var timesheet = await dbContext.Timesheets
            .Include(t => t.Entries)
            .SingleOrDefaultAsync(t => t.UserId == userId && t.WorkDate == workDate);

        if (timesheet is not null)
        {
            return timesheet;
        }

        timesheet = new Timesheet
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            WorkDate = workDate,
            Status = TimesheetStatus.Draft
        };

        dbContext.Timesheets.Add(timesheet);
        await dbContext.SaveChangesAsync();
        return timesheet;
    }

    private async Task<int> GetAttendanceNetMinutes(Guid userId, DateOnly workDate)
    {
        var sessions = await dbContext.WorkSessions
            .Include(ws => ws.Breaks)
            .Where(ws => ws.UserId == userId && ws.WorkDate == workDate)
            .ToListAsync();

        if (sessions.Count == 0)
        {
            return 0;
        }

        var policy = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.WorkPolicy)
            .SingleOrDefaultAsync();

        return attendanceCalculationService.Calculate(sessions, policy, DateTime.UtcNow).NetMinutes;
    }

    private async Task<bool> CanWriteProject(Guid userId, Guid projectId)
    {
        var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "employee";
        var projects = dbContext.Projects.AsNoTracking().Where(p => p.Id == projectId && p.IsActive && !p.IsArchived);

        if (!string.Equals(userRole, "admin", StringComparison.OrdinalIgnoreCase))
        {
            projects = projects.Where(p => p.Members.Any(m => m.UserId == userId));
        }

        return await projects.AnyAsync();
    }

    private async Task<IActionResult?> ValidateEditWindow(Guid userId, DateOnly workDate)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (workDate > today)
        {
            return BadRequest(new { message = "Future dates are not allowed for timesheet entry." });
        }

        var backdateLimit = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.WorkPolicy != null ? u.WorkPolicy.TimesheetBackdateWindowDays : 7)
            .SingleOrDefaultAsync();

        if (workDate < today.AddDays(-backdateLimit))
        {
            return BadRequest(new { message = $"Timesheet editing window is limited to the last {backdateLimit} day(s)." });
        }

        return null;
    }

    private async Task<TimesheetDayResponse> BuildDayResponse(Guid userId, DateOnly workDate)
    {
        var timesheet = await dbContext.Timesheets
            .Include(t => t.Entries)
            .ThenInclude(e => e.Project)
            .Include(t => t.Entries)
            .ThenInclude(e => e.TaskCategory)
            .SingleOrDefaultAsync(t => t.UserId == userId && t.WorkDate == workDate);

        var attendanceNet = await GetAttendanceNetMinutes(userId, workDate);
        var entered = timesheet?.Entries.Sum(e => e.Minutes) ?? 0;
        var remaining = Math.Max(0, attendanceNet - entered);
        var hasMismatch = attendanceNet != entered;

        return new TimesheetDayResponse(
            timesheet?.Id ?? Guid.Empty,
            workDate,
            (timesheet?.Status ?? TimesheetStatus.Draft).ToString().ToLowerInvariant(),
            attendanceNet,
            entered,
            remaining,
            hasMismatch,
            timesheet?.MismatchReason,
            (timesheet?.Entries ?? [])
                .OrderBy(e => e.Project.Name)
                .ThenBy(e => e.TaskCategory.Name)
                .Select(e => new TimesheetEntryResponse(
                    e.Id,
                    e.ProjectId,
                    e.Project.Name,
                    e.TaskCategoryId,
                    e.TaskCategory.Name,
                    e.Minutes,
                    e.Notes))
                .ToList());
    }
}

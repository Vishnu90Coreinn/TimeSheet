using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Services;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/timesheets")]
public class TimesheetsController(TimeSheetDbContext dbContext, IAttendanceCalculationService attendanceCalculationService, IAuditService auditService) : ControllerBase
{
    [HttpGet("entry-options")]
    public async Task<IActionResult> GetEntryOptions()
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        // Task 1 fix: all authenticated users see all active projects in the dropdown.
        // Membership-based filtering was removed — non-admin users were getting an empty
        // project list when not yet added to any project as a member.
        var projects = await dbContext.Projects.AsNoTracking()
            .Where(p => p.IsActive && !p.IsArchived)
            .OrderBy(p => p.Name)
            .Select(p => new ProjectResponse(p.Id, p.Name, p.Code, p.IsActive, p.IsArchived, p.BudgetedHours))
            .ToListAsync();

        var categories = await dbContext.TaskCategories.AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new TaskCategoryResponse(c.Id, c.Name, c.IsActive, c.IsBillable))
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
            dto.ExpectedMinutes,
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
        if (userId is null) return Unauthorized();

        var anchor = anyDateInWeek ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var weekStart = StartOfWeek(anchor);
        var weekEnd = weekStart.AddDays(6);

        // Batch load all data for the week
        var timesheets = await dbContext.Timesheets
            .Include(t => t.Entries)
            .ThenInclude(e => e.Project)
            .Include(t => t.Entries)
            .ThenInclude(e => e.TaskCategory)
            .Where(t => t.UserId == userId.Value && t.WorkDate >= weekStart && t.WorkDate <= weekEnd)
            .ToListAsync();

        var sessions = await dbContext.WorkSessions
            .Include(ws => ws.Breaks)
            .Where(ws => ws.UserId == userId.Value && ws.WorkDate >= weekStart && ws.WorkDate <= weekEnd)
            .ToListAsync();

        var leaves = await dbContext.LeaveRequests
            .AsNoTracking()
            .Where(l => l.UserId == userId.Value && l.LeaveDate >= weekStart && l.LeaveDate <= weekEnd && l.Status == LeaveRequestStatus.Approved)
            .ToListAsync();

        var holidayDates = await dbContext.Holidays
            .AsNoTracking()
            .Where(h => h.Date >= weekStart && h.Date <= weekEnd)
            .Select(h => h.Date)
            .ToListAsync();

        var policy = await dbContext.Users.AsNoTracking()
            .Where(u => u.Id == userId.Value)
            .Select(u => new { ExpectedMinutes = u.WorkPolicy != null ? u.WorkPolicy.DailyExpectedMinutes : 480, Policy = u.WorkPolicy })
            .SingleOrDefaultAsync();

        var now = DateTime.UtcNow;
        var days = new List<TimesheetWeekDayResponse>();

        for (var i = 0; i < 7; i++)
        {
            var day = weekStart.AddDays(i);
            var timesheet = timesheets.SingleOrDefault(t => t.WorkDate == day);
            var daySessions = sessions.Where(ws => ws.WorkDate == day).ToList();
            var dayLeave = leaves.SingleOrDefault(l => l.LeaveDate == day);

            var attendanceNet = daySessions.Count > 0
                ? attendanceCalculationService.Calculate(daySessions, policy?.Policy, now).NetMinutes
                : 0;

            // Sunday is a rest day — no expected hours
            var expectedMinutes = day.DayOfWeek == DayOfWeek.Sunday ? 0 : (policy?.ExpectedMinutes ?? 480);
            if (day.DayOfWeek != DayOfWeek.Sunday)
            {
                if (holidayDates.Contains(day)) expectedMinutes = 0;
                else if (dayLeave is not null) expectedMinutes = dayLeave.IsHalfDay ? expectedMinutes / 2 : 0;
            }

            var entered = timesheet?.Entries.Sum(e => e.Minutes) ?? 0;
            var hasMismatch = attendanceNet != entered;

            days.Add(new TimesheetWeekDayResponse(
                day,
                (timesheet?.Status ?? TimesheetStatus.Draft).ToString().ToLowerInvariant(),
                entered,
                attendanceNet,
                expectedMinutes,
                hasMismatch));
        }

        return Ok(new TimesheetWeekResponse(
            weekStart,
            weekEnd,
            days.Sum(d => d.EnteredMinutes),
            days.Sum(d => d.AttendanceNetMinutes),
            days.Sum(d => d.ExpectedMinutes),
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

        await auditService.WriteAsync(request.EntryId.HasValue ? "TimesheetEntryUpdated" : "TimesheetEntryCreated", "TimesheetEntry", entry.Id.ToString(), $"Entry for {request.WorkDate}", User);
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
        await auditService.WriteAsync("TimesheetEntryDeleted", "TimesheetEntry", entryId.ToString(), $"Entry deleted for {entry.Timesheet.WorkDate}", User);
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

        await auditService.WriteAsync("TimesheetSubmitted", "Timesheet", timesheet.Id.ToString(), $"Submitted timesheet for {request.WorkDate}", User);
        await dbContext.SaveChangesAsync();
        return Ok(await BuildDayResponse(userId.Value, request.WorkDate));
    }

    [HttpPost("submit-week")]
    public async Task<ActionResult<SubmitWeekResponse>> SubmitWeek([FromBody] SubmitWeekRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        // Validate weekStart is a Monday
        if (request.WeekStart.DayOfWeek != DayOfWeek.Monday)
            return BadRequest(new { message = "WeekStart must be a Monday." });

        var isActive = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (bool?)u.IsActive)
            .SingleOrDefaultAsync();

        if (isActive is null) return Unauthorized();
        if (isActive is false)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Inactive users cannot submit timesheets." });

        var backdateLimit = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId.Value)
            .Select(u => u.WorkPolicy != null ? u.WorkPolicy.TimesheetBackdateWindowDays : 7)
            .SingleOrDefaultAsync();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Load all timesheets for the week in one query
        var weekEnd = request.WeekStart.AddDays(6);
        var weekTimesheets = await dbContext.Timesheets
            .Include(t => t.Entries)
            .Where(t => t.UserId == userId.Value && t.WorkDate >= request.WeekStart && t.WorkDate <= weekEnd)
            .ToListAsync();

        var submitted = new List<string>();
        var skipped   = new List<SubmitWeekSkipped>();
        var errors    = new List<SubmitWeekError>();

        // Process Mon–Sat (skip Sunday index 6)
        for (var i = 0; i < 6; i++)
        {
            var day = request.WeekStart.AddDays(i);
            var dateStr = day.ToString("yyyy-MM-dd");

            // Future date guard
            if (day > today) { skipped.Add(new(dateStr, "Future date")); continue; }

            // Backdate window guard
            if (day < today.AddDays(-backdateLimit)) { errors.Add(new(dateStr, $"Outside the {backdateLimit}-day editing window.")); continue; }

            var timesheet = weekTimesheets.SingleOrDefault(t => t.WorkDate == day);

            // No timesheet or no entries — skip silently
            if (timesheet is null || timesheet.Entries.Count == 0)
            { skipped.Add(new(dateStr, "No entries")); continue; }

            // Already submitted / approved / rejected
            if (timesheet.Status != TimesheetStatus.Draft)
            { skipped.Add(new(dateStr, $"Already {timesheet.Status.ToString().ToLowerInvariant()}")); continue; }

            // Calculate mismatch (informational only — bulk submit does not require a reason)
            var attendanceNet = await GetAttendanceNetMinutes(userId.Value, day);
            var entered = timesheet.Entries.Sum(e => e.Minutes);
            var hasMismatch = attendanceNet != entered;

            timesheet.Status = TimesheetStatus.Submitted;
            timesheet.SubmittedAtUtc = DateTime.UtcNow;
            timesheet.MismatchReason = hasMismatch ? "(bulk submit)" : null;

            await auditService.WriteAsync("TimesheetSubmitted", "Timesheet", timesheet.Id.ToString(), $"Bulk submitted for {day}", User);
            submitted.Add(dateStr);
        }

        if (submitted.Count > 0)
            await dbContext.SaveChangesAsync();

        return Ok(new SubmitWeekResponse(submitted, skipped, errors));
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

    private async Task<int> GetExpectedMinutes(Guid userId, DateOnly workDate)
    {
        var expected = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.WorkPolicy != null ? u.WorkPolicy.DailyExpectedMinutes : 480)
            .SingleOrDefaultAsync();

        var approvedLeave = await dbContext.LeaveRequests
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.LeaveDate == workDate && x.Status == LeaveRequestStatus.Approved)
            .SingleOrDefaultAsync();

        if (approvedLeave is null)
        {
            return expected;
        }

        return approvedLeave.IsHalfDay ? expected / 2 : 0;
    }

    private async Task<bool> CanWriteProject(Guid userId, Guid projectId)
    {
        // Task 1 fix: all authenticated users may log time against any active project.
        // Membership enforcement was removed to match the dropdown visibility change.
        _ = userId; // kept in signature for potential future re-use
        return await dbContext.Projects.AsNoTracking()
            .AnyAsync(p => p.Id == projectId && p.IsActive && !p.IsArchived);
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
        var expectedMinutes = await GetExpectedMinutes(userId, workDate);
        var entered = timesheet?.Entries.Sum(e => e.Minutes) ?? 0;
        var remaining = Math.Max(0, expectedMinutes - entered);
        var hasMismatch = attendanceNet != entered;

        return new TimesheetDayResponse(
            timesheet?.Id ?? Guid.Empty,
            workDate,
            (timesheet?.Status ?? TimesheetStatus.Draft).ToString().ToLowerInvariant(),
            attendanceNet,
            expectedMinutes,
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

using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Timesheets.Commands;
using TimeSheet.Application.Timesheets.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/timesheets")]
public class TimesheetsController(
    ISender mediator,
    TimeSheetDbContext dbContext,
    IAttendanceCalculationService attendanceCalc,
    IAuditService auditService) : ControllerBase
{
    [HttpGet("entry-options")]
    public async Task<IActionResult> GetEntryOptions(CancellationToken ct)
    {
        var result = await mediator.Send(new GetEntryOptionsQuery(), ct);
        if (!result.IsSuccess) return Fail(result);

        var r = result.Value!;
        return Ok(new
        {
            projects = r.Projects.Select(p => new ProjectResponse(p.Id, p.Name, p.Code, p.IsActive, p.IsArchived, p.BudgetedHours)).ToList(),
            taskCategories = r.TaskCategories.Select(c => new TaskCategoryResponse(c.Id, c.Name, c.IsActive, c.IsBillable)).ToList()
        });
    }

    [HttpGet("day")]
    public async Task<IActionResult> GetDay([FromQuery] DateOnly? workDate, CancellationToken ct)
    {
        var result = await mediator.Send(new GetDayTimesheetQuery(workDate), ct);
        if (!result.IsSuccess) return Fail(result);
        return Ok(MapDay(result.Value!));
    }

    [HttpGet("daily-totals")]
    public async Task<IActionResult> GetDailyTotals([FromQuery] DateOnly? workDate, CancellationToken ct)
    {
        var result = await mediator.Send(new GetDayTimesheetQuery(workDate), ct);
        if (!result.IsSuccess) return Fail(result);

        var r = result.Value!;
        return Ok(new
        {
            r.WorkDate,
            r.AttendanceNetMinutes,
            r.ExpectedMinutes,
            r.EnteredMinutes,
            r.RemainingMinutes,
            r.HasMismatch,
            r.MismatchReason
        });
    }

    [HttpGet("week")]
    public async Task<IActionResult> GetWeek([FromQuery] DateOnly? anyDateInWeek, CancellationToken ct)
    {
        var result = await mediator.Send(new GetWeekTimesheetQuery(anyDateInWeek), ct);
        if (!result.IsSuccess) return Fail(result);

        var r = result.Value!;
        return Ok(new TimesheetWeekResponse(
            r.WeekStart,
            r.WeekEnd,
            r.WeekEnteredMinutes,
            r.WeekAttendanceMinutes,
            r.WeekExpectedMinutes,
            r.Days.Select(d => new TimesheetWeekDayResponse(
                d.WorkDate, d.Status, d.EnteredMinutes, d.AttendanceNetMinutes, d.ExpectedMinutes, d.HasMismatch))
              .ToList()));
    }

    [HttpPost("entries")]
    public async Task<IActionResult> UpsertEntry([FromBody] UpsertTimesheetEntryRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(
            new UpsertTimesheetEntryCommand(
                request.WorkDate,
                request.EntryId,
                request.ProjectId,
                request.TaskCategoryId,
                request.Minutes,
                request.Notes),
            ct);

        if (!result.IsSuccess) return Fail(result);
        return Ok(MapDay(result.Value!));
    }

    [HttpDelete("entries/{entryId:guid}")]
    public async Task<IActionResult> DeleteEntry(Guid entryId, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        // Minimal DB lookup to retrieve WorkDate (needed by command; avoids adding WorkDate to route)
        var entry = await dbContext.TimesheetEntries
            .Include(e => e.Timesheet)
            .AsNoTracking()
            .SingleOrDefaultAsync(e => e.Id == entryId && e.Timesheet.UserId == userId.Value, ct);

        if (entry is null) return NotFound();

        var result = await mediator.Send(
            new DeleteTimesheetEntryCommand(entryId, entry.Timesheet.WorkDate),
            ct);

        if (!result.IsSuccess) return Fail(result);
        return Ok(MapDay(result.Value!));
    }

    [HttpPost("submit")]
    public async Task<IActionResult> Submit([FromBody] SubmitTimesheetRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var isActive = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (bool?)u.IsActive)
            .SingleOrDefaultAsync(ct);

        if (isActive is null) return Unauthorized();
        if (isActive is false)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Inactive users cannot submit timesheets." });

        var result = await mediator.Send(
            new SubmitTimesheetCommand(request.WorkDate, request.Notes, request.MismatchReason),
            ct);

        if (!result.IsSuccess) return Fail(result);
        return Ok(MapDay(result.Value!));
    }

    [HttpPost("copy")]
    public async Task<IActionResult> CopyDay([FromBody] CopyTimesheetRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var validation = await ValidateEditWindow(userId.Value, request.TargetDate);
        if (validation is not null) return validation;

        var source = await dbContext.Timesheets
            .Include(t => t.Entries)
            .Where(t => t.UserId == userId.Value && t.WorkDate == request.SourceDate)
            .SingleOrDefaultAsync();

        if (source is null || source.Entries.Count == 0)
            return BadRequest(new { message = "No source entries found for the source date." });

        var target = await GetOrCreateDraftTimesheet(userId.Value, request.TargetDate);
        if (target.Status != TimesheetStatus.Draft)
            return Conflict(new { message = "Only draft timesheets can be edited." });

        var existing = await dbContext.TimesheetEntries.Where(e => e.TimesheetId == target.Id).ToListAsync();
        if (existing.Count > 0)
            dbContext.TimesheetEntries.RemoveRange(existing);

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

    [HttpPost("submit-week")]
    public async Task<ActionResult<SubmitWeekResponse>> SubmitWeek([FromBody] SubmitWeekRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

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

        var weekEnd = request.WeekStart.AddDays(6);
        var weekTimesheets = await dbContext.Timesheets
            .Include(t => t.Entries)
            .Where(t => t.UserId == userId.Value && t.WorkDate >= request.WeekStart && t.WorkDate <= weekEnd)
            .ToListAsync();

        var submitted = new List<string>();
        var skipped = new List<SubmitWeekSkipped>();
        var errors = new List<SubmitWeekError>();

        // Process Mon–Sat (skip Sunday index 6)
        for (var i = 0; i < 6; i++)
        {
            var day = request.WeekStart.AddDays(i);
            var dateStr = day.ToString("yyyy-MM-dd");

            if (day > today) { skipped.Add(new(dateStr, "Future date")); continue; }
            if (day < today.AddDays(-backdateLimit)) { errors.Add(new(dateStr, $"Outside the {backdateLimit}-day editing window.")); continue; }

            var timesheet = weekTimesheets.SingleOrDefault(t => t.WorkDate == day);

            if (timesheet is null || timesheet.Entries.Count == 0)
            { skipped.Add(new(dateStr, "No entries")); continue; }

            if (timesheet.Status != TimesheetStatus.Draft)
            { skipped.Add(new(dateStr, $"Already {timesheet.Status.ToString().ToLowerInvariant()}")); continue; }

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

    // ── Private helpers ───────────────────────────────────────────────────────

    private static TimesheetDayResponse MapDay(AppInterfaces.TimesheetDayResult r) =>
        new(r.TimesheetId, r.WorkDate, r.Status, r.AttendanceNetMinutes, r.ExpectedMinutes,
            r.EnteredMinutes, r.RemainingMinutes, r.HasMismatch, r.MismatchReason,
            r.Entries.Select(e => new TimesheetEntryResponse(e.Id, e.ProjectId, e.ProjectName,
                e.TaskCategoryId, e.TaskCategoryName, e.Minutes, e.Notes)).ToList());

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Forbid(),
        ResultStatus.Conflict => Conflict(new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };

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

        if (timesheet is not null) return timesheet;

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

        if (sessions.Count == 0) return 0;

        var policy = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.WorkPolicy)
            .SingleOrDefaultAsync();

        return attendanceCalc.Calculate(sessions, policy, DateTime.UtcNow).NetMinutes;
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

        if (approvedLeave is null) return expected;
        return approvedLeave.IsHalfDay ? expected / 2 : 0;
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
                    e.Id, e.ProjectId, e.Project.Name,
                    e.TaskCategoryId, e.TaskCategory.Name,
                    e.Minutes, e.Notes))
                .ToList());
    }

    private async Task<IActionResult?> ValidateEditWindow(Guid userId, DateOnly workDate)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (workDate > today)
            return BadRequest(new { message = "Future dates are not allowed for timesheet entry." });

        var backdateLimit = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.WorkPolicy != null ? u.WorkPolicy.TimesheetBackdateWindowDays : 7)
            .SingleOrDefaultAsync();

        if (workDate < today.AddDays(-backdateLimit))
            return BadRequest(new { message = $"Timesheet editing window is limited to the last {backdateLimit} day(s)." });

        return null;
    }
}

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/attendance")]
public class AttendanceController(TimeSheetDbContext dbContext, IAttendanceCalculationService calculationService) : ControllerBase
{
    [HttpPost("check-in")]
    public async Task<ActionResult<AttendanceSummaryResponse>> CheckIn([FromBody] CheckInRequest request)
    {
        var userId = TryGetUserId();
        if (userId is null) return Unauthorized();

        var checkInAtUtc = request.CheckInAtUtc ?? DateTime.UtcNow;
        await FlagMissingCheckoutSessions(userId.Value, DateOnly.FromDateTime(checkInAtUtc));

        var activeExists = await dbContext.WorkSessions.AnyAsync(s => s.UserId == userId && s.Status == WorkSessionStatus.Active);
        if (activeExists)
        {
            return Conflict(new { message = "Cannot check in while an active session exists." });
        }

        var session = new WorkSession
        {
            UserId = userId.Value,
            WorkDate = DateOnly.FromDateTime(checkInAtUtc),
            CheckInAtUtc = checkInAtUtc,
            Status = WorkSessionStatus.Active
        };

        dbContext.WorkSessions.Add(session);
        await dbContext.SaveChangesAsync();

        return Ok(await BuildSummary(userId.Value, session.WorkDate));
    }

    [HttpPost("check-out")]
    public async Task<ActionResult<AttendanceSummaryResponse>> CheckOut([FromBody] CheckOutRequest request)
    {
        var userId = TryGetUserId();
        if (userId is null) return Unauthorized();

        var session = await dbContext.WorkSessions
            .Include(s => s.Breaks)
            .Where(s => s.UserId == userId && s.Status == WorkSessionStatus.Active)
            .OrderByDescending(s => s.CheckInAtUtc)
            .FirstOrDefaultAsync();

        if (session is null)
        {
            return BadRequest(new { message = "No active session found for check-out." });
        }

        var checkOutAtUtc = request.CheckOutAtUtc ?? DateTime.UtcNow;
        if (checkOutAtUtc <= session.CheckInAtUtc)
        {
            return BadRequest(new { message = "Check-out time must be after check-in time." });
        }

        var activeBreak = session.Breaks.FirstOrDefault(b => b.EndAtUtc is null);
        if (activeBreak is not null)
        {
            activeBreak.EndAtUtc = checkOutAtUtc;
            activeBreak.DurationMinutes = (int)Math.Max(0, (checkOutAtUtc - activeBreak.StartAtUtc).TotalMinutes);
        }

        session.CheckOutAtUtc = checkOutAtUtc;
        session.Status = WorkSessionStatus.Completed;

        await dbContext.SaveChangesAsync();
        return Ok(await BuildSummary(userId.Value, session.WorkDate));
    }

    [HttpPost("breaks/start")]
    public async Task<ActionResult<AttendanceSummaryResponse>> StartBreak([FromBody] StartBreakRequest request)
    {
        var userId = TryGetUserId();
        if (userId is null) return Unauthorized();

        var session = await dbContext.WorkSessions
            .Include(s => s.Breaks)
            .Where(s => s.UserId == userId && s.Status == WorkSessionStatus.Active)
            .OrderByDescending(s => s.CheckInAtUtc)
            .FirstOrDefaultAsync();

        if (session is null)
        {
            return BadRequest(new { message = "Cannot start break without an active work session." });
        }

        if (session.Breaks.Any(b => b.EndAtUtc is null))
        {
            return Conflict(new { message = "Cannot start a new break while another break is active." });
        }

        var startAtUtc = request.StartAtUtc ?? DateTime.UtcNow;
        if (startAtUtc < session.CheckInAtUtc)
        {
            return BadRequest(new { message = "Break cannot start before check-in." });
        }

        dbContext.BreakEntries.Add(new BreakEntry
        {
            Id = Guid.NewGuid(),
            WorkSessionId = session.Id,
            StartAtUtc = startAtUtc,
            IsManualEdit = false
        });

        await dbContext.SaveChangesAsync();
        return Ok(await BuildSummary(userId.Value, session.WorkDate));
    }

    [HttpPost("breaks/end")]
    public async Task<ActionResult<AttendanceSummaryResponse>> EndBreak([FromBody] EndBreakRequest request)
    {
        var userId = TryGetUserId();
        if (userId is null) return Unauthorized();

        var session = await dbContext.WorkSessions
            .Include(s => s.Breaks)
            .Where(s => s.UserId == userId && s.Status == WorkSessionStatus.Active)
            .OrderByDescending(s => s.CheckInAtUtc)
            .FirstOrDefaultAsync();

        if (session is null)
        {
            return BadRequest(new { message = "Cannot end break without an active work session." });
        }

        var activeBreak = session.Breaks.OrderByDescending(b => b.StartAtUtc).FirstOrDefault(b => b.EndAtUtc is null);
        if (activeBreak is null)
        {
            return BadRequest(new { message = "No active break found." });
        }

        var endAtUtc = request.EndAtUtc ?? DateTime.UtcNow;
        if (endAtUtc <= activeBreak.StartAtUtc)
        {
            return BadRequest(new { message = "Break end time must be after break start time." });
        }

        activeBreak.EndAtUtc = endAtUtc;
        activeBreak.DurationMinutes = (int)Math.Max(0, (endAtUtc - activeBreak.StartAtUtc).TotalMinutes);

        await dbContext.SaveChangesAsync();
        return Ok(await BuildSummary(userId.Value, session.WorkDate));
    }

    [HttpPut("breaks/manual-edit")]
    public async Task<ActionResult<AttendanceSummaryResponse>> ManualBreakEdit([FromBody] ManualBreakEditRequest request)
    {
        var userId = TryGetUserId();
        if (userId is null) return Unauthorized();

        var user = await dbContext.Users.Include(u => u.WorkPolicy).SingleOrDefaultAsync(u => u.Id == userId.Value);
        if (user is null) return Unauthorized();

        if (!(user.WorkPolicy?.AllowManualBreakEdits ?? false) && !User.IsInRole("admin"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Manual break edits are disabled by policy." });
        }

        var breakEntry = await dbContext.BreakEntries
            .Include(b => b.WorkSession)
            .ThenInclude(s => s.Breaks)
            .SingleOrDefaultAsync(b => b.Id == request.BreakEntryId && b.WorkSession.UserId == userId.Value);

        if (breakEntry is null)
        {
            return NotFound();
        }

        if (request.EndAtUtc <= request.StartAtUtc)
        {
            return BadRequest(new { message = "Break end time must be after break start time." });
        }

        var overlaps = breakEntry.WorkSession.Breaks
            .Where(b => b.Id != breakEntry.Id && b.EndAtUtc.HasValue)
            .Any(other => request.StartAtUtc < other.EndAtUtc && request.EndAtUtc > other.StartAtUtc);

        if (overlaps)
        {
            return Conflict(new { message = "Manual break overlaps an existing break." });
        }

        breakEntry.StartAtUtc = request.StartAtUtc;
        breakEntry.EndAtUtc = request.EndAtUtc;
        breakEntry.DurationMinutes = (int)(request.EndAtUtc - request.StartAtUtc).TotalMinutes;
        breakEntry.IsManualEdit = true;

        await dbContext.SaveChangesAsync();
        return Ok(await BuildSummary(userId.Value, breakEntry.WorkSession.WorkDate));
    }

    [HttpGet("summary/today")]
    public async Task<ActionResult<AttendanceSummaryResponse>> GetTodaySummary()
    {
        var userId = TryGetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await BuildSummary(userId.Value, DateOnly.FromDateTime(DateTime.UtcNow)));
    }

    [HttpGet("history")]
    public async Task<ActionResult<IEnumerable<AttendanceDayHistoryResponse>>> GetHistory([FromQuery] DateOnly? fromDate, [FromQuery] DateOnly? toDate)
    {
        var userId = TryGetUserId();
        if (userId is null) return Unauthorized();

        var start = fromDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7));
        var end = toDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        if (end < start)
        {
            return BadRequest(new { message = "Invalid date range." });
        }

        var sessions = await dbContext.WorkSessions.AsNoTracking()
            .Include(s => s.Breaks)
            .Where(s => s.UserId == userId && s.WorkDate >= start && s.WorkDate <= end)
            .OrderByDescending(s => s.WorkDate)
            .ThenBy(s => s.CheckInAtUtc)
            .ToListAsync();

        var policy = await dbContext.Users.AsNoTracking()
            .Where(u => u.Id == userId.Value)
            .Select(u => u.WorkPolicy)
            .SingleOrDefaultAsync();

        var response = sessions
            .GroupBy(s => s.WorkDate)
            .Select(group =>
            {
                var totals = calculationService.Calculate(group.ToList(), policy, DateTime.UtcNow);
                return new AttendanceDayHistoryResponse(
                    group.Key,
                    group.Count(),
                    totals.GrossMinutes,
                    totals.FixedLunchMinutes,
                    totals.BreakMinutes,
                    totals.NetMinutes,
                    group.Any(s => s.HasAttendanceException),
                    group.Select(s => new SessionHistoryResponse(
                        s.Id,
                        s.CheckInAtUtc,
                        s.CheckOutAtUtc,
                        s.Status.ToString(),
                        s.HasAttendanceException,
                        s.Breaks.OrderBy(b => b.StartAtUtc)
                            .Select(ToBreakResponse)
                            .ToList()))
                    .ToList());
            })
            .ToList();

        return Ok(response);
    }

    [HttpGet("breaks/summary")]
    public async Task<IActionResult> GetBreakSummary([FromQuery] DateOnly? fromDate, [FromQuery] DateOnly? toDate)
    {
        var userId = TryGetUserId();
        if (userId is null) return Unauthorized();

        var start = fromDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7));
        var end = toDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var sessions = await dbContext.WorkSessions.AsNoTracking()
            .Include(s => s.Breaks)
            .Where(s => s.UserId == userId && s.WorkDate >= start && s.WorkDate <= end)
            .ToListAsync();

        var totalBreakMinutes = sessions.SelectMany(s => s.Breaks).Sum(b => b.DurationMinutes);
        var daysWithBreaks = sessions.GroupBy(s => s.WorkDate).Count(g => g.SelectMany(x => x.Breaks).Any());

        return Ok(new { fromDate = start, toDate = end, totalBreakMinutes, daysWithBreaks });
    }

    private async Task<AttendanceSummaryResponse> BuildSummary(Guid userId, DateOnly workDate)
    {
        await FlagMissingCheckoutSessions(userId, workDate);

        var user = await dbContext.Users.AsNoTracking().Include(u => u.WorkPolicy).SingleAsync(u => u.Id == userId);
        var sessions = await dbContext.WorkSessions
            .AsNoTracking()
            .Include(s => s.Breaks)
            .Where(s => s.UserId == userId && s.WorkDate == workDate)
            .OrderBy(s => s.CheckInAtUtc)
            .ToListAsync();

        var totals = calculationService.Calculate(sessions, user.WorkPolicy, DateTime.UtcNow);
        var activeSession = sessions.LastOrDefault(s => s.Status == WorkSessionStatus.Active);

        return new AttendanceSummaryResponse(
            activeSession?.Id,
            workDate,
            activeSession is null ? "checked-out" : "checked-in",
            sessions.LastOrDefault()?.CheckInAtUtc,
            sessions.LastOrDefault()?.CheckOutAtUtc,
            sessions.Any(s => s.HasAttendanceException),
            sessions.Count,
            totals.GrossMinutes,
            totals.FixedLunchMinutes,
            totals.BreakMinutes,
            totals.NetMinutes,
            activeSession?.Breaks.OrderBy(b => b.StartAtUtc).Select(ToBreakResponse).ToList() ?? []);
    }

    private async Task FlagMissingCheckoutSessions(Guid userId, DateOnly currentDate)
    {
        var staleSessions = await dbContext.WorkSessions
            .Where(s => s.UserId == userId && s.Status == WorkSessionStatus.Active && s.WorkDate < currentDate)
            .ToListAsync();

        if (staleSessions.Count == 0) return;

        foreach (var session in staleSessions)
        {
            session.Status = WorkSessionStatus.MissingCheckout;
            session.HasAttendanceException = true;
            foreach (var br in await dbContext.BreakEntries.Where(b => b.WorkSessionId == session.Id && b.EndAtUtc == null).ToListAsync())
            {
                br.EndAtUtc = session.CheckInAtUtc.AddHours(9);
                br.DurationMinutes = (int)Math.Max(0, (br.EndAtUtc.Value - br.StartAtUtc).TotalMinutes);
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private static BreakEntryResponse ToBreakResponse(BreakEntry breakEntry)
    {
        return new BreakEntryResponse(
            breakEntry.Id,
            breakEntry.StartAtUtc,
            breakEntry.EndAtUtc,
            breakEntry.DurationMinutes,
            breakEntry.IsManualEdit,
            breakEntry.EndAtUtc is null);
    }

    private Guid? TryGetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

        return Guid.TryParse(sub, out var userId) ? userId : null;
    }
}

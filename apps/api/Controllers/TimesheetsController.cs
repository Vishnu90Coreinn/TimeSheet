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
    TimeSheetDbContext dbContext) : ControllerBase
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
    public async Task<IActionResult> CopyDay([FromBody] CopyTimesheetRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new CopyDayCommand(request.SourceDate, request.TargetDate), ct);
        if (!result.IsSuccess) return Fail(result);
        return Ok(MapDay(result.Value!));
    }

    [HttpPost("submit-week")]
    public async Task<IActionResult> SubmitWeek([FromBody] SubmitWeekRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new SubmitWeekCommand(request.WeekStart), ct);
        if (!result.IsSuccess) return Fail(result);
        var v = result.Value!;
        return Ok(new SubmitWeekResponse(
            v.Submitted,
            v.Skipped.Select(s => new TimeSheet.Api.Dtos.SubmitWeekSkipped(s.Date, s.Reason)).ToList(),
            v.Errors.Select(e => new TimeSheet.Api.Dtos.SubmitWeekError(e.Date, e.Message)).ToList()));
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

}

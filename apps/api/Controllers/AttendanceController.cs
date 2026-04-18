using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Hubs;
using TimeSheet.Application.Attendance.Commands;
using TimeSheet.Application.Attendance.Queries;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/attendance")]
public class AttendanceController(ISender mediator, IHubContext<TimeSheetHub> hub, TimeSheetDbContext db) : ControllerBase
{
    [HttpPost("check-in")]
    public async Task<ActionResult<AttendanceSummaryResponse>> CheckIn([FromBody] CheckInRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new CheckInCommand(request.CheckInAtUtc), ct);
        if (!result.IsSuccess) return Fail(result);

        var currentUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.AsNoTracking()
            .Select(u => new { u.Id, u.ManagerId, u.Username })
            .FirstOrDefaultAsync(u => u.Id == currentUserId, ct);
        if (user?.ManagerId != null)
            await hub.Clients.Group($"manager-{user.ManagerId}").SendAsync(
                TimeSheetHub.TeamClockIn,
                new { userId = currentUserId, username = user.Username },
                ct);
        await hub.Clients.All.SendAsync(TimeSheetHub.DashboardUpdated, new { }, ct);

        return Ok(ToSummaryResponse(result.Value!));
    }

    [HttpPost("check-out")]
    public async Task<ActionResult<AttendanceSummaryResponse>> CheckOut([FromBody] CheckOutRequest request, CancellationToken ct)
        => FromSummaryResult(await mediator.Send(new CheckOutCommand(request.CheckOutAtUtc), ct));

    [HttpPost("breaks/start")]
    public async Task<ActionResult<AttendanceSummaryResponse>> StartBreak([FromBody] StartBreakRequest request, CancellationToken ct)
        => FromSummaryResult(await mediator.Send(new StartBreakCommand(request.StartAtUtc), ct));

    [HttpPost("breaks/end")]
    public async Task<ActionResult<AttendanceSummaryResponse>> EndBreak([FromBody] EndBreakRequest request, CancellationToken ct)
        => FromSummaryResult(await mediator.Send(new EndBreakCommand(request.EndAtUtc), ct));

    [HttpPut("breaks/manual-edit")]
    public async Task<ActionResult<AttendanceSummaryResponse>> ManualBreakEdit([FromBody] ManualBreakEditRequest request, CancellationToken ct)
        => FromSummaryResult(await mediator.Send(new ManualBreakEditCommand(request.BreakEntryId, request.StartAtUtc, request.EndAtUtc), ct));

    [HttpGet("summary/today")]
    public async Task<ActionResult<AttendanceSummaryResponse>> GetTodaySummary(CancellationToken ct)
        => FromSummaryResult(await mediator.Send(new GetTodayAttendanceSummaryQuery(), ct));

    [HttpGet("history")]
    public async Task<ActionResult<IEnumerable<AttendanceDayHistoryResponse>>> GetHistory([FromQuery] DateOnly? fromDate, [FromQuery] DateOnly? toDate, CancellationToken ct)
    {
        var result = await mediator.Send(new GetAttendanceHistoryQuery(fromDate, toDate), ct);
        return result.IsSuccess
            ? Ok(result.Value!.Select(ToHistoryResponse).ToList())
            : Fail(result);
    }

    [HttpGet("breaks/summary")]
    public async Task<IActionResult> GetBreakSummary([FromQuery] DateOnly? fromDate, [FromQuery] DateOnly? toDate, CancellationToken ct)
    {
        var result = await mediator.Send(new GetBreakSummaryQuery(fromDate, toDate), ct);
        return result.IsSuccess
            ? Ok(new
            {
                fromDate = result.Value!.FromDate,
                toDate = result.Value.ToDate,
                totalBreakMinutes = result.Value.TotalBreakMinutes,
                daysWithBreaks = result.Value.DaysWithBreaks
            })
            : Fail(result);
    }

    [HttpGet("sessions/today")]
    public async Task<ActionResult<IEnumerable<WorkSessionDto>>> GetTodaySessions(CancellationToken ct)
    {
        var result = await mediator.Send(new GetTodayWorkSessionsQuery(), ct);
        return result.IsSuccess
            ? Ok(result.Value!.Select(ToWorkSessionDto).ToList())
            : Fail(result);
    }

    private ActionResult<AttendanceSummaryResponse> FromSummaryResult(Result<AttendanceSummaryResult> result)
        => result.IsSuccess ? Ok(ToSummaryResponse(result.Value!)) : Fail(result);

    private static AttendanceSummaryResponse ToSummaryResponse(AttendanceSummaryResult summary)
        => new(
            summary.ActiveSessionId,
            summary.WorkDate,
            summary.Status,
            summary.LastCheckInAtUtc,
            summary.LastCheckOutAtUtc,
            summary.HasAttendanceException,
            summary.SessionCount,
            summary.GrossMinutes,
            summary.FixedLunchMinutes,
            summary.BreakMinutes,
            summary.NetMinutes,
            summary.ActiveSessionBreaks.Select(ToBreakResponse).ToList());

    private static AttendanceDayHistoryResponse ToHistoryResponse(AttendanceDayHistoryResult day)
        => new(
            day.WorkDate,
            day.SessionCount,
            day.GrossMinutes,
            day.FixedLunchMinutes,
            day.BreakMinutes,
            day.NetMinutes,
            day.HasAttendanceException,
            day.Sessions.Select(ToSessionResponse).ToList());

    private static SessionHistoryResponse ToSessionResponse(SessionHistoryResult session)
        => new(
            session.Id,
            session.CheckInAtUtc,
            session.CheckOutAtUtc,
            session.Status,
            session.HasAttendanceException,
            session.Breaks.Select(ToBreakResponse).ToList());

    private static WorkSessionDto ToWorkSessionDto(WorkSessionResult session)
        => new(session.Id, session.CheckInAtUtc, session.CheckOutAtUtc, session.DurationMinutes);

    private static BreakEntryResponse ToBreakResponse(BreakEntryResult breakEntry)
        => new(breakEntry.Id, breakEntry.StartAtUtc, breakEntry.EndAtUtc, breakEntry.DurationMinutes, breakEntry.IsManualEdit, breakEntry.IsActive);

    private ActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Unauthorized(),
        ResultStatus.Conflict => Conflict(new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

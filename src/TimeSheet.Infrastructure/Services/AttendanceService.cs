using TimeSheet.Application.Attendance.Queries;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;
using InfraServices = TimeSheet.Infrastructure.Services;

namespace TimeSheet.Infrastructure.Services;

public class AttendanceService(
    IAttendanceRepository attendanceRepository,
    IUnitOfWork unitOfWork,
    InfraServices.IAttendanceCalculationService calculationService) : IAttendanceService
{
    public async Task<AttendanceSummaryResult> CheckInAsync(Guid userId, DateTime? checkInAtUtc, CancellationToken ct = default)
    {
        var effectiveCheckIn = checkInAtUtc ?? DateTime.UtcNow;
        await FlagMissingCheckoutSessionsAsync(userId, DateOnly.FromDateTime(effectiveCheckIn), ct);

        if (await attendanceRepository.HasActiveSessionAsync(userId, ct))
            throw new InvalidOperationException("Cannot check in while an active session exists.");

        attendanceRepository.AddWorkSession(new WorkSession
        {
            UserId = userId,
            WorkDate = DateOnly.FromDateTime(effectiveCheckIn),
            CheckInAtUtc = effectiveCheckIn,
            Status = WorkSessionStatus.Active
        });

        await unitOfWork.SaveChangesAsync(ct);
        return await BuildSummaryAsync(userId, DateOnly.FromDateTime(effectiveCheckIn), ct);
    }

    public async Task<AttendanceSummaryResult> CheckOutAsync(Guid userId, DateTime? checkOutAtUtc, CancellationToken ct = default)
    {
        var session = await attendanceRepository.GetLatestActiveSessionAsync(userId, ct)
            ?? throw new InvalidOperationException("No active session found for check-out.");

        var effectiveCheckOut = checkOutAtUtc ?? DateTime.UtcNow;
        if (effectiveCheckOut <= session.CheckInAtUtc)
            throw new ArgumentException("Check-out time must be after check-in time.");

        var activeBreak = session.Breaks.FirstOrDefault(b => b.EndAtUtc is null);
        if (activeBreak is not null)
        {
            activeBreak.EndAtUtc = effectiveCheckOut;
            activeBreak.DurationMinutes = (int)Math.Max(0, (effectiveCheckOut - activeBreak.StartAtUtc).TotalMinutes);
        }

        session.CheckOut(effectiveCheckOut);
        await unitOfWork.SaveChangesAsync(ct);
        return await BuildSummaryAsync(userId, session.WorkDate, ct);
    }

    public async Task<AttendanceSummaryResult> StartBreakAsync(Guid userId, DateTime? startAtUtc, CancellationToken ct = default)
    {
        var session = await attendanceRepository.GetLatestActiveSessionAsync(userId, ct)
            ?? throw new InvalidOperationException("Cannot start break without an active work session.");

        if (session.Breaks.Any(b => b.EndAtUtc is null))
            throw new InvalidOperationException("Cannot start a new break while another break is active.");

        var effectiveStart = startAtUtc ?? DateTime.UtcNow;
        if (effectiveStart < session.CheckInAtUtc)
            throw new ArgumentException("Break cannot start before check-in.");

        attendanceRepository.AddBreakEntry(new BreakEntry
        {
            Id = Guid.NewGuid(),
            WorkSessionId = session.Id,
            StartAtUtc = effectiveStart,
            IsManualEdit = false
        });

        await unitOfWork.SaveChangesAsync(ct);
        return await BuildSummaryAsync(userId, session.WorkDate, ct);
    }

    public async Task<AttendanceSummaryResult> EndBreakAsync(Guid userId, DateTime? endAtUtc, CancellationToken ct = default)
    {
        var session = await attendanceRepository.GetLatestActiveSessionAsync(userId, ct)
            ?? throw new InvalidOperationException("Cannot end break without an active work session.");

        var activeBreak = session.Breaks.OrderByDescending(b => b.StartAtUtc).FirstOrDefault(b => b.EndAtUtc is null)
            ?? throw new InvalidOperationException("No active break found.");

        var effectiveEnd = endAtUtc ?? DateTime.UtcNow;
        if (effectiveEnd <= activeBreak.StartAtUtc)
            throw new ArgumentException("Break end time must be after break start time.");

        activeBreak.EndAtUtc = effectiveEnd;
        activeBreak.DurationMinutes = (int)Math.Max(0, (effectiveEnd - activeBreak.StartAtUtc).TotalMinutes);

        await unitOfWork.SaveChangesAsync(ct);
        return await BuildSummaryAsync(userId, session.WorkDate, ct);
    }

    public async Task<AttendanceSummaryResult> ManualBreakEditAsync(Guid userId, Guid breakEntryId, DateTime startAtUtc, DateTime endAtUtc, bool isAdmin, CancellationToken ct = default)
    {
        var user = await attendanceRepository.GetUserWithPolicyAsync(userId, ct) ?? throw new UnauthorizedAccessException();
        if (!(user.WorkPolicy?.AllowManualBreakEdits ?? false) && !isAdmin)
            throw new UnauthorizedAccessException("Manual break edits are disabled by policy.");

        var breakEntry = await attendanceRepository.GetBreakEntryForUserAsync(breakEntryId, userId, ct)
            ?? throw new KeyNotFoundException();

        if (endAtUtc <= startAtUtc)
            throw new ArgumentException("Break end time must be after break start time.");

        var overlaps = breakEntry.WorkSession.Breaks
            .Where(b => b.Id != breakEntry.Id && b.EndAtUtc.HasValue)
            .Any(other => startAtUtc < other.EndAtUtc && endAtUtc > other.StartAtUtc);
        if (overlaps)
            throw new InvalidOperationException("Manual break overlaps an existing break.");

        breakEntry.StartAtUtc = startAtUtc;
        breakEntry.EndAtUtc = endAtUtc;
        breakEntry.DurationMinutes = (int)(endAtUtc - startAtUtc).TotalMinutes;
        breakEntry.IsManualEdit = true;

        await unitOfWork.SaveChangesAsync(ct);
        return await BuildSummaryAsync(userId, breakEntry.WorkSession.WorkDate, ct);
    }

    public Task<AttendanceSummaryResult> GetTodaySummaryAsync(Guid userId, CancellationToken ct = default)
        => BuildSummaryAsync(userId, DateOnly.FromDateTime(DateTime.UtcNow), ct);

    public async Task<IReadOnlyList<AttendanceDayHistoryResult>> GetHistoryAsync(Guid userId, DateOnly? fromDate, DateOnly? toDate, CancellationToken ct = default)
    {
        var start = fromDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7));
        var end = toDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        if (end < start)
            throw new ArgumentException("Invalid date range.");

        var sessions = await attendanceRepository.GetSessionsByUserAndRangeAsync(userId, start, end, ct);
        var policy = (await attendanceRepository.GetUserWithPolicyAsync(userId, ct))?.WorkPolicy;

        return sessions.GroupBy(s => s.WorkDate)
            .Select(group =>
            {
                var totals = calculationService.Calculate(group.ToList(), policy, DateTime.UtcNow);
                return new AttendanceDayHistoryResult(
                    group.Key,
                    group.Count(),
                    totals.GrossMinutes,
                    totals.FixedLunchMinutes,
                    totals.BreakMinutes,
                    totals.NetMinutes,
                    group.Any(s => s.HasAttendanceException),
                    group.Select(s => new SessionHistoryResult(
                        s.Id,
                        s.CheckInAtUtc,
                        s.CheckOutAtUtc,
                        s.Status.ToString(),
                        s.HasAttendanceException,
                        s.Breaks.OrderBy(b => b.StartAtUtc).Select(ToBreakResult).ToList()))
                    .ToList());
            })
            .ToList();
    }

    public async Task<BreakSummaryResult> GetBreakSummaryAsync(Guid userId, DateOnly? fromDate, DateOnly? toDate, CancellationToken ct = default)
    {
        var start = fromDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7));
        var end = toDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var sessions = await attendanceRepository.GetSessionsByUserAndRangeAsync(userId, start, end, ct);
        return new BreakSummaryResult(
            start,
            end,
            sessions.SelectMany(s => s.Breaks).Sum(b => b.DurationMinutes),
            sessions.GroupBy(s => s.WorkDate).Count(g => g.SelectMany(x => x.Breaks).Any()));
    }

    public async Task<IReadOnlyList<WorkSessionResult>> GetTodaySessionsAsync(Guid userId, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return (await attendanceRepository.GetSessionsByUserAndDateAsync(userId, today, ct))
            .Select(s => new WorkSessionResult(
                s.Id,
                s.CheckInAtUtc,
                s.CheckOutAtUtc,
                s.CheckOutAtUtc.HasValue ? (int?)(int)(s.CheckOutAtUtc.Value - s.CheckInAtUtc).TotalMinutes : null))
            .ToList();
    }

    private async Task<AttendanceSummaryResult> BuildSummaryAsync(Guid userId, DateOnly workDate, CancellationToken ct)
    {
        await FlagMissingCheckoutSessionsAsync(userId, workDate, ct);

        var user = await attendanceRepository.GetUserWithPolicyAsync(userId, ct) ?? throw new UnauthorizedAccessException();
        var sessions = await attendanceRepository.GetSessionsByUserAndDateAsync(userId, workDate, ct);
        var totals = calculationService.Calculate(sessions, user.WorkPolicy, DateTime.UtcNow);
        var activeSession = sessions.LastOrDefault(s => s.Status == WorkSessionStatus.Active);

        return new AttendanceSummaryResult(
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
            activeSession?.Breaks.OrderBy(b => b.StartAtUtc).Select(ToBreakResult).ToList() ?? []);
    }

    private async Task FlagMissingCheckoutSessionsAsync(Guid userId, DateOnly currentDate, CancellationToken ct)
    {
        var staleSessions = await attendanceRepository.GetStaleActiveSessionsAsync(userId, currentDate, ct);
        if (staleSessions.Count == 0) return;

        var openBreaks = await attendanceRepository.GetOpenBreakEntriesBySessionIdsAsync(staleSessions.Select(s => s.Id).ToList(), ct);
        foreach (var session in staleSessions)
        {
            session.Status = WorkSessionStatus.MissingCheckout;
            session.HasAttendanceException = true;

            foreach (var br in openBreaks.Where(b => b.WorkSessionId == session.Id))
            {
                br.EndAtUtc = session.CheckInAtUtc.AddHours(9);
                br.DurationMinutes = (int)Math.Max(0, (br.EndAtUtc.Value - br.StartAtUtc).TotalMinutes);
            }
        }

        await unitOfWork.SaveChangesAsync(ct);
    }

    private static BreakEntryResult ToBreakResult(BreakEntry breakEntry)
        => new(breakEntry.Id, breakEntry.StartAtUtc, breakEntry.EndAtUtc, breakEntry.DurationMinutes, breakEntry.IsManualEdit, breakEntry.EndAtUtc is null);
}

using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Timers.Queries;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class TimerService(ITimerRepository repository, IUnitOfWork unitOfWork) : ITimerService
{
    public async Task<TimerSessionResult?> GetActiveAsync(Guid userId, CancellationToken ct = default)
        => Map(await repository.GetActiveByUserAsync(userId, ct));

    public async Task<TimerStartResult> StartAsync(Guid userId, Guid projectId, Guid categoryId, string? note, CancellationToken ct = default)
    {
        if (await repository.HasActiveAsync(userId, ct))
            return new TimerStartResult(TimerStartOutcome.ActiveExists, null);
        var project = await repository.GetProjectAsync(projectId, ct);
        if (project is null) return new TimerStartResult(TimerStartOutcome.ProjectNotFound, null);
        var category = await repository.GetTaskCategoryAsync(categoryId, ct);
        if (category is null) return new TimerStartResult(TimerStartOutcome.CategoryNotFound, null);

        var timer = new TimerSession
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ProjectId = projectId,
            CategoryId = categoryId,
            Note = note?.Trim(),
            StartedAtUtc = DateTime.UtcNow,
            Project = project,
            Category = category
        };

        repository.AddTimer(timer);
        await unitOfWork.SaveChangesAsync(ct);
        return new TimerStartResult(TimerStartOutcome.Started, Map(timer)!);
    }

    public async Task<TimerStopOutcome> StopAsync(Guid userId, CancellationToken ct = default)
    {
        var timer = await repository.GetActiveByUserAsync(userId, ct);
        if (timer is null) return new TimerStopOutcome(TimerStopOutcomeType.NotFound, null);
        timer.StoppedAtUtc = DateTime.UtcNow;
        timer.DurationMinutes = (int)Math.Max(1, Math.Round((timer.StoppedAtUtc.Value - timer.StartedAtUtc).TotalMinutes));
        await unitOfWork.SaveChangesAsync(ct);
        return new TimerStopOutcome(TimerStopOutcomeType.Stopped, Map(timer));
    }

    public async Task<TimerConvertOutcome> ConvertAsync(Guid userId, Guid timerId, DateOnly workDate, CancellationToken ct = default)
    {
        var timer = await repository.GetByIdForUserAsync(timerId, userId, ct);
        if (timer is null) return new TimerConvertOutcome(TimerConvertOutcomeType.TimerNotFound, null, null);
        if (timer.StoppedAtUtc is null) return new TimerConvertOutcome(TimerConvertOutcomeType.TimerStillRunning, null, null);
        if (timer.ConvertedToEntryId.HasValue) return new TimerConvertOutcome(TimerConvertOutcomeType.AlreadyConverted, null, null);
        if (timer.DurationMinutes is null or < 1) return new TimerConvertOutcome(TimerConvertOutcomeType.InvalidDuration, null, null);

        var timesheet = await repository.GetTimesheetByUserAndDateAsync(userId, workDate, ct);
        if (timesheet is null)
        {
            timesheet = new Timesheet { UserId = userId, WorkDate = workDate, Status = TimesheetStatus.Draft };
            repository.AddTimesheet(timesheet);
            await unitOfWork.SaveChangesAsync(ct);
        }
        else if (timesheet.Status != TimesheetStatus.Draft)
        {
            return new TimerConvertOutcome(TimerConvertOutcomeType.TimesheetLocked, null, null);
        }

        var entry = new TimesheetEntry
        {
            Id = Guid.NewGuid(),
            TimesheetId = timesheet.Id,
            ProjectId = timer.ProjectId,
            TaskCategoryId = timer.CategoryId,
            Minutes = timer.DurationMinutes.Value,
            Notes = timer.Note
        };

        repository.AddEntry(entry);
        timer.ConvertedToEntryId = entry.Id;
        await unitOfWork.SaveChangesAsync(ct);
        return new TimerConvertOutcome(TimerConvertOutcomeType.Success, entry.Id, timesheet.Id);
    }

    public async Task<IReadOnlyList<TimerSessionResult>> GetHistoryAsync(Guid userId, DateOnly? date, CancellationToken ct = default)
    {
        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        return (await repository.GetByUserAndDateAsync(userId, targetDate, ct)).Select(t => Map(t)!).ToList();
    }

    private static TimerSessionResult? Map(TimerSession? t) => t is null
        ? null
        : new TimerSessionResult(
            t.Id,
            t.ProjectId,
            t.Project?.Name ?? string.Empty,
            t.CategoryId,
            t.Category?.Name ?? string.Empty,
            t.Note,
            DateTime.SpecifyKind(t.StartedAtUtc, DateTimeKind.Utc).ToString("O"),
            t.StoppedAtUtc.HasValue ? DateTime.SpecifyKind(t.StoppedAtUtc.Value, DateTimeKind.Utc).ToString("O") : null,
            t.DurationMinutes,
            t.ConvertedToEntryId);
}

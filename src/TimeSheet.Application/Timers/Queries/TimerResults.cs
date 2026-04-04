namespace TimeSheet.Application.Timers.Queries;

public record TimerSessionResult(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    Guid CategoryId,
    string CategoryName,
    string? Note,
    string StartedAtUtc,
    string? StoppedAtUtc,
    int? DurationMinutes,
    Guid? ConvertedToEntryId);

public enum TimerStartOutcome
{
    Started,
    ActiveExists,
    ProjectNotFound,
    CategoryNotFound
}

public record TimerStartResult(TimerStartOutcome Outcome, TimerSessionResult? Timer);

public enum TimerStopOutcomeType
{
    Stopped,
    NotFound
}

public record TimerStopOutcome(TimerStopOutcomeType Outcome, TimerSessionResult? Timer);

public enum TimerConvertOutcomeType
{
    Success,
    TimerNotFound,
    TimerStillRunning,
    AlreadyConverted,
    InvalidDuration,
    TimesheetLocked
}

public record TimerConvertOutcome(TimerConvertOutcomeType Outcome, Guid? EntryId, Guid? TimesheetId);

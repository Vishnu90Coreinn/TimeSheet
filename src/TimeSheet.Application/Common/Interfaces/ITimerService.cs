using TimeSheet.Application.Timers.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface ITimerService
{
    Task<TimerSessionResult?> GetActiveAsync(Guid userId, CancellationToken ct = default);
    Task<TimerStartResult> StartAsync(Guid userId, Guid projectId, Guid categoryId, string? note, CancellationToken ct = default);
    Task<TimerStopOutcome> StopAsync(Guid userId, CancellationToken ct = default);
    Task<TimerConvertOutcome> ConvertAsync(Guid userId, Guid timerId, DateOnly workDate, CancellationToken ct = default);
    Task<IReadOnlyList<TimerSessionResult>> GetHistoryAsync(Guid userId, DateOnly? date, CancellationToken ct = default);
}

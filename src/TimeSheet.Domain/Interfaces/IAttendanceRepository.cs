using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IAttendanceRepository
{
    Task<bool> HasActiveSessionAsync(Guid userId, CancellationToken ct = default);
    Task<WorkSession?> GetLatestActiveSessionAsync(Guid userId, CancellationToken ct = default);
    Task<BreakEntry?> GetBreakEntryForUserAsync(Guid breakEntryId, Guid userId, CancellationToken ct = default);
    Task<User?> GetUserWithPolicyAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<WorkSession>> GetSessionsByUserAndDateAsync(Guid userId, DateOnly workDate, CancellationToken ct = default);
    Task<IReadOnlyList<WorkSession>> GetSessionsByUserAndRangeAsync(Guid userId, DateOnly fromDate, DateOnly toDate, CancellationToken ct = default);
    Task<IReadOnlyList<WorkSession>> GetStaleActiveSessionsAsync(Guid userId, DateOnly beforeDate, CancellationToken ct = default);
    Task<IReadOnlyList<BreakEntry>> GetOpenBreakEntriesBySessionIdsAsync(IReadOnlyCollection<Guid> sessionIds, CancellationToken ct = default);
    void AddWorkSession(WorkSession session);
    void AddBreakEntry(BreakEntry breakEntry);
}

using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface ITimesheetRepository
{
    Task<Timesheet?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Timesheet?> GetByUserAndDateAsync(Guid userId, DateOnly workDate, CancellationToken ct = default);
    Task<IReadOnlyList<Timesheet>> GetPendingForManagerAsync(Guid managerId, CancellationToken ct = default);
    Task<IReadOnlyList<Timesheet>> GetByUserAndDateRangeAsync(Guid userId, DateOnly from, DateOnly to, CancellationToken ct = default);
    void Add(Timesheet timesheet);
    void Remove(Timesheet timesheet);
    void AddEntry(TimesheetEntry entry);
    void RemoveEntry(TimesheetEntry entry);
    void AddApprovalAction(ApprovalAction action);
    Task<IReadOnlyList<Timesheet>> GetByUserAndWeekTrackedAsync(Guid userId, DateOnly weekStart, DateOnly weekEnd, CancellationToken ct = default);
    Task<(IReadOnlyList<PendingApprovalTimesheetRow> Items, int TotalCount, int Page)> GetPendingForManagersPageAsync(
        IReadOnlyCollection<Guid> managerIds,
        string? search,
        bool? hasMismatch,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);
}

public record PendingApprovalTimesheetRow(
    Guid TimesheetId,
    Guid UserId,
    Guid? ManagerId,
    string Username,
    string DisplayName,
    DateOnly WorkDate,
    int EnteredMinutes,
    string Status,
    DateTime? SubmittedAtUtc,
    bool HasMismatch,
    string? MismatchReason);

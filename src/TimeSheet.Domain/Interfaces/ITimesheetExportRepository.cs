namespace TimeSheet.Domain.Interfaces;

public interface ITimesheetExportRepository
{
    Task<IReadOnlyList<TimesheetExportUserRow>> GetExportableUsersAsync(Guid callerId, string role, CancellationToken ct = default);
    Task<IReadOnlyList<Guid>> GetPermittedUserIdsAsync(Guid callerId, string role, CancellationToken ct = default);
    Task<IReadOnlyList<TimesheetExportRow>> GetExportRowsAsync(IReadOnlyList<Guid> userIds, DateOnly from, DateOnly to, CancellationToken ct = default);
}

public record TimesheetExportUserRow(Guid Id, string DisplayName, string Username);

public record TimesheetExportRow(
    DateOnly Date,
    string Employee,
    string Status,
    string Project,
    string TaskCategory,
    int Minutes,
    string Notes);

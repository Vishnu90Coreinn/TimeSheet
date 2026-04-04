namespace TimeSheet.Domain.Interfaces;

public interface IManagerRepository
{
    Task<(IReadOnlyList<TeamMemberStatusRow> Items, int TotalCount, int Page)> GetTeamStatusPageAsync(
        Guid managerId,
        DateOnly date,
        string? search,
        string? attendance,
        string? timesheetStatus,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<bool> IsDirectReportAsync(Guid managerId, Guid userId, CancellationToken ct = default);
}

public record TeamMemberStatusRow(
    Guid UserId,
    string Username,
    string DisplayName,
    string? AvatarDataUrl,
    string Attendance,
    string? CheckInAtUtc,
    string? CheckOutAtUtc,
    int WeekLoggedMinutes,
    int WeekExpectedMinutes,
    string TodayTimesheetStatus,
    int PendingApprovalCount);

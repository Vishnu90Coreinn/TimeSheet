using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Manager.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface IManagerQueryService
{
    Task<PagedResult<TeamMemberStatusResult>> GetTeamStatusPageAsync(
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

    Task<bool> SendReminderAsync(Guid managerId, Guid userId, CancellationToken ct = default);
}

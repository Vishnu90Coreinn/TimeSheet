using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.TimesheetExports.Queries;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class TimesheetExportService(ITimesheetExportRepository repository) : ITimesheetExportService
{
    public async Task<IReadOnlyList<TimesheetExportUserResult>> GetExportableUsersAsync(Guid callerId, string role, CancellationToken ct = default)
        => (await repository.GetExportableUsersAsync(callerId, role, ct))
            .Select(x => new TimesheetExportUserResult(x.Id, x.DisplayName, x.Username))
            .ToList();

    public async Task<TimesheetExportDataResult> BuildExportAsync(Guid callerId, string role, DateOnly fromDate, DateOnly toDate, Guid? userId, IReadOnlyList<Guid>? userIds, CancellationToken ct = default)
    {
        var permittedIds = await repository.GetPermittedUserIdsAsync(callerId, role, ct);
        List<Guid> targetIds;
        if (userIds is { Count: > 0 })
        {
            targetIds = userIds.Distinct().ToList();
            if (targetIds.Any(id => !permittedIds.Contains(id)))
                throw new UnauthorizedAccessException("You are not permitted to export data for one or more selected users.");
        }
        else if (userId.HasValue)
        {
            if (!permittedIds.Contains(userId.Value))
                throw new UnauthorizedAccessException("You are not permitted to export data for that user.");
            targetIds = [userId.Value];
        }
        else
        {
            targetIds = permittedIds.ToList();
        }

        var rows = await repository.GetExportRowsAsync(targetIds, fromDate, toDate, ct);
        return new TimesheetExportDataResult(
            rows.Select(r => new TimesheetExportRowResult(r.Date, r.Employee, r.Status, r.Project, r.TaskCategory, r.Minutes, r.Notes)).ToList(),
            $"timesheets-{fromDate:yyyy-MM-dd}-to-{toDate:yyyy-MM-dd}");
    }
}

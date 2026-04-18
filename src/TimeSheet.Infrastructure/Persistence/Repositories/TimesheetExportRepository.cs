using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class TimesheetExportRepository(TimeSheetDbContext dbContext) : ITimesheetExportRepository
{
    public async Task<IReadOnlyList<TimesheetExportUserRow>> GetExportableUsersAsync(Guid callerId, string role, CancellationToken ct = default)
    {
        var normalizedRole = (role ?? "employee").ToLowerInvariant();
        IQueryable<Domain.Entities.User> query = dbContext.Users.AsNoTracking().Where(u => u.IsActive);

        query = normalizedRole switch
        {
            "admin" => query,
            "manager" => query.Where(u => u.ManagerId == callerId || u.Id == callerId),
            _ => query.Where(u => u.Id == callerId)
        };

        return await query.OrderBy(u => u.DisplayName)
            .Select(u => new TimesheetExportUserRow(u.Id, u.DisplayName, u.Username))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Guid>> GetPermittedUserIdsAsync(Guid callerId, string role, CancellationToken ct = default)
    {
        var normalizedRole = (role ?? "employee").ToLowerInvariant();
        IQueryable<Domain.Entities.User> query = dbContext.Users.AsNoTracking().Where(u => u.IsActive);
        query = normalizedRole switch
        {
            "admin" => query,
            "manager" => query.Where(u => u.ManagerId == callerId || u.Id == callerId),
            _ => query.Where(u => u.Id == callerId)
        };

        return await query.Select(u => u.Id).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<TimesheetExportRow>> GetExportRowsAsync(IReadOnlyList<Guid> userIds, DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        var raw = await dbContext.TimesheetEntries.AsNoTracking()
            .Where(e => userIds.Contains(e.Timesheet.UserId) && e.Timesheet.WorkDate >= from && e.Timesheet.WorkDate <= to)
            .OrderBy(e => e.Timesheet.WorkDate)
            .ThenBy(e => e.Timesheet.UserId)
            .Select(e => new TimesheetExportDbRow(
                e.Timesheet.WorkDate,
                string.IsNullOrWhiteSpace(e.Timesheet.User.DisplayName) ? e.Timesheet.User.Username : e.Timesheet.User.DisplayName,
                e.Timesheet.Status,
                e.Project.Name,
                e.TaskCategory.Name,
                e.Minutes,
                e.Notes ?? string.Empty))
            .ToListAsync(ct);

        return raw.Select(x => new TimesheetExportRow(
            x.WorkDate,
            x.DisplayName,
            x.Status.ToString(),
            x.ProjectName,
            x.TaskCategoryName,
            x.Minutes,
            x.Notes)).ToList();
    }

    private sealed record TimesheetExportDbRow(
        DateOnly WorkDate,
        string DisplayName,
        TimesheetStatus Status,
        string ProjectName,
        string TaskCategoryName,
        int Minutes,
        string Notes);
}

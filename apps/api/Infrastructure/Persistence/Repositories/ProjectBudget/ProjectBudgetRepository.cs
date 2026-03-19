using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;

namespace TimeSheet.Api.Infrastructure.Persistence.Repositories.ProjectBudget;

public class ProjectBudgetRepository(TimeSheetDbContext dbContext) : IProjectBudgetRepository
{
    public async Task<IReadOnlyList<(Guid Id, string Name, string? Code, double BudgetedHours)>> GetActiveProjectsAsync(CancellationToken cancellationToken)
    {
        var projects = await dbContext.Projects
            .AsNoTracking()
            .Where(p => p.IsActive && !p.IsArchived)
            .Select(p => new { p.Id, p.Name, p.Code, p.BudgetedHours })
            .ToListAsync(cancellationToken);

        return projects.Select(x => (x.Id, x.Name, x.Code, x.BudgetedHours)).ToList();
    }

    public async Task<Dictionary<Guid, long>> GetTotalMinutesByProjectAsync(IReadOnlyCollection<Guid> projectIds, CancellationToken cancellationToken)
    {
        var minutesByProject = await dbContext.TimesheetEntries
            .AsNoTracking()
            .Where(e => projectIds.Contains(e.ProjectId))
            .GroupBy(e => e.ProjectId)
            .Select(g => new { ProjectId = g.Key, TotalMinutes = g.Sum(e => (long)e.Minutes) })
            .ToListAsync(cancellationToken);

        return minutesByProject.ToDictionary(x => x.ProjectId, x => x.TotalMinutes);
    }

    public async Task<(Guid Id, string Name, double BudgetedHours)?> GetProjectForSummaryAsync(Guid id, CancellationToken cancellationToken)
    {
        var project = await dbContext.Projects
            .AsNoTracking()
            .Select(p => new { p.Id, p.Name, p.BudgetedHours })
            .SingleOrDefaultAsync(p => p.Id == id, cancellationToken);

        return project is null ? null : (project.Id, project.Name, project.BudgetedHours);
    }

    public async Task<IReadOnlyList<(int Minutes, DateOnly WorkDate)>> GetProjectEntriesForSummaryAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var entries = await dbContext.TimesheetEntries
            .AsNoTracking()
            .Where(e => e.ProjectId == projectId)
            .Select(e => new { e.Minutes, e.Timesheet.WorkDate })
            .ToListAsync(cancellationToken);

        return entries.Select(e => (e.Minutes, e.WorkDate)).ToList();
    }
}

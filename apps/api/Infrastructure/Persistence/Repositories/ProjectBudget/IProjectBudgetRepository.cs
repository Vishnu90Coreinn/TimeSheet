using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Infrastructure.Persistence.Repositories.ProjectBudget;

public interface IProjectBudgetRepository
{
    Task<IReadOnlyList<(Guid Id, string Name, string? Code, double BudgetedHours)>> GetActiveProjectsAsync(CancellationToken cancellationToken);
    Task<Dictionary<Guid, long>> GetTotalMinutesByProjectAsync(IReadOnlyCollection<Guid> projectIds, CancellationToken cancellationToken);
    Task<(Guid Id, string Name, double BudgetedHours)?> GetProjectForSummaryAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<(int Minutes, DateOnly WorkDate)>> GetProjectEntriesForSummaryAsync(Guid projectId, CancellationToken cancellationToken);
}

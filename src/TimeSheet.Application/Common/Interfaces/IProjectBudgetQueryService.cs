using TimeSheet.Application.ProjectBudget.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface IProjectBudgetQueryService
{
    Task<IReadOnlyList<ProjectBudgetHealthItemResult>> GetBudgetHealthAsync(CancellationToken ct = default);
    Task<ProjectBudgetSummaryResult?> GetBudgetSummaryAsync(Guid projectId, CancellationToken ct = default);
}

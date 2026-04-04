using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.ProjectBudget.Queries;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class ProjectBudgetQueryService(IProjectBudgetRepository repository) : IProjectBudgetQueryService
{
    public async Task<IReadOnlyList<ProjectBudgetHealthItemResult>> GetBudgetHealthAsync(CancellationToken ct = default)
        => (await repository.GetBudgetHealthAsync(ct))
            .Select(x => new ProjectBudgetHealthItemResult(x.Id, x.Name, x.Code, x.BudgetedHours, x.LoggedHours, x.PctUsed, x.Status))
            .ToList();

    public async Task<ProjectBudgetSummaryResult?> GetBudgetSummaryAsync(Guid projectId, CancellationToken ct = default)
    {
        var result = await repository.GetBudgetSummaryAsync(projectId, ct);
        return result is null ? null : new ProjectBudgetSummaryResult(
            result.Id,
            result.Name,
            result.BudgetedHours,
            result.LoggedHours,
            result.RemainingHours,
            result.BurnRateHoursPerWeek,
            result.ProjectedWeeksRemaining,
            result.WeeklyBreakdown.Select(x => new WeeklyBurnEntryResult(x.WeekStart, x.Hours)).ToList());
    }
}

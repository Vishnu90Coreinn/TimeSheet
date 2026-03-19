using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.ProjectBudget.Services;

public interface IProjectBudgetService
{
    Task<(IReadOnlyList<ProjectBudgetHealthItem>? Data, OperationError? Error)> GetBudgetHealthAsync(CancellationToken cancellationToken);
    Task<(ProjectBudgetSummaryResponse? Data, OperationError? Error)> GetBudgetSummaryAsync(Guid id, CancellationToken cancellationToken);
}

using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.ProjectBudget.Services;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.ProjectBudget.Handlers;

public interface IGetProjectBudgetHealthHandler
{
    Task<(IReadOnlyList<ProjectBudgetHealthItem>? Data, OperationError? Error)> HandleAsync(CancellationToken cancellationToken);
}

public class GetProjectBudgetHealthHandler(IProjectBudgetService service) : IGetProjectBudgetHealthHandler
{
    public Task<(IReadOnlyList<ProjectBudgetHealthItem>? Data, OperationError? Error)> HandleAsync(CancellationToken cancellationToken)
        => service.GetBudgetHealthAsync(cancellationToken);
}

public interface IGetProjectBudgetSummaryHandler
{
    Task<(ProjectBudgetSummaryResponse? Data, OperationError? Error)> HandleAsync(Guid id, CancellationToken cancellationToken);
}

public class GetProjectBudgetSummaryHandler(IProjectBudgetService service) : IGetProjectBudgetSummaryHandler
{
    public Task<(ProjectBudgetSummaryResponse? Data, OperationError? Error)> HandleAsync(Guid id, CancellationToken cancellationToken)
        => service.GetBudgetSummaryAsync(id, cancellationToken);
}

using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ProjectBudget.Queries;

public class GetProjectBudgetHealthQueryHandler(IProjectBudgetQueryService service)
    : IRequestHandler<GetProjectBudgetHealthQuery, Result<IReadOnlyList<ProjectBudgetHealthItemResult>>>
{
    public async Task<Result<IReadOnlyList<ProjectBudgetHealthItemResult>>> Handle(GetProjectBudgetHealthQuery request, CancellationToken cancellationToken)
        => Result<IReadOnlyList<ProjectBudgetHealthItemResult>>.Success(await service.GetBudgetHealthAsync(cancellationToken));
}

public class GetProjectBudgetSummaryQueryHandler(IProjectBudgetQueryService service)
    : IRequestHandler<GetProjectBudgetSummaryQuery, Result<ProjectBudgetSummaryResult>>
{
    public async Task<Result<ProjectBudgetSummaryResult>> Handle(GetProjectBudgetSummaryQuery request, CancellationToken cancellationToken)
    {
        var result = await service.GetBudgetSummaryAsync(request.ProjectId, cancellationToken);
        return result is null
            ? Result<ProjectBudgetSummaryResult>.NotFound("Project not found.")
            : Result<ProjectBudgetSummaryResult>.Success(result);
    }
}

using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ProjectBudget.Queries;

public record GetProjectBudgetHealthQuery : IRequest<Result<IReadOnlyList<ProjectBudgetHealthItemResult>>>;
public record GetProjectBudgetSummaryQuery(Guid ProjectId) : IRequest<Result<ProjectBudgetSummaryResult>>;

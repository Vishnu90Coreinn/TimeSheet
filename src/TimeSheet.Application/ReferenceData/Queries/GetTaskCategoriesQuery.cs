using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Queries;

public record GetTaskCategoriesQuery(bool AdminAll = false) : IRequest<Result<List<TaskCategoryResult>>>;

public record TaskCategoryResult(Guid Id, string Name, bool IsActive, bool IsBillable);

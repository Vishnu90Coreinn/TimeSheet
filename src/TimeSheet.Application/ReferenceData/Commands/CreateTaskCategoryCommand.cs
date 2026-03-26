using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Commands;

public record CreateTaskCategoryCommand(string Name, bool IsActive, bool IsBillable) : IRequest<Result<TaskCategoryMutationResult>>;

public record TaskCategoryMutationResult(Guid Id, string Name, bool IsActive, bool IsBillable);

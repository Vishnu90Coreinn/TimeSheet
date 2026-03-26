using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Commands;

public record UpdateTaskCategoryCommand(Guid Id, string Name, bool IsActive, bool IsBillable) : IRequest<Result>;

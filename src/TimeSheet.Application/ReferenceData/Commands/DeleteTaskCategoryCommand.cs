using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Commands;

public record DeleteTaskCategoryCommand(Guid Id) : IRequest<Result>;

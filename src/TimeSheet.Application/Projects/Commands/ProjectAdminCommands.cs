using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Application.Projects.Commands;

public record CreateProjectCommand(string Name, string Code, bool IsActive, int BudgetedHours) : IRequest<Result<ProjectDetailResult>>;
public record UpdateProjectCommand(Guid Id, string Name, string Code, bool IsActive, int BudgetedHours) : IRequest<Result>;
public record DeleteProjectCommand(Guid Id) : IRequest<Result>;
public record ArchiveProjectCommand(Guid Id) : IRequest<Result>;
public record SetProjectMembersCommand(Guid Id, IReadOnlyCollection<Guid> UserIds) : IRequest<Result>;

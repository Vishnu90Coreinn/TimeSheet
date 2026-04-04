using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Application.Projects.Queries;

public record GetProjectByIdQuery(Guid Id) : IRequest<Result<ProjectDetailResult>>;
public record GetProjectMembersQuery(Guid Id) : IRequest<Result<IReadOnlyList<ProjectMemberResult>>>;

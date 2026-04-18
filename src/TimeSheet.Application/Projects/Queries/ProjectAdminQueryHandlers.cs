using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Projects.Queries;

public class GetProjectByIdQueryHandler(IProjectQueryService projectQueryService)
    : IRequestHandler<GetProjectByIdQuery, Result<ProjectDetailResult>>
{
    public async Task<Result<ProjectDetailResult>> Handle(GetProjectByIdQuery request, CancellationToken cancellationToken)
    {
        var project = await projectQueryService.GetByIdAsync(request.Id, cancellationToken);
        return project is null ? Result<ProjectDetailResult>.NotFound("Project not found.") : Result<ProjectDetailResult>.Success(project);
    }
}

public class GetProjectMembersQueryHandler(IProjectQueryService projectQueryService)
    : IRequestHandler<GetProjectMembersQuery, Result<IReadOnlyList<ProjectMemberResult>>>
{
    public async Task<Result<IReadOnlyList<ProjectMemberResult>>> Handle(GetProjectMembersQuery request, CancellationToken cancellationToken)
    {
        var members = await projectQueryService.GetMembersAsync(request.Id, cancellationToken);
        return members is null
            ? Result<IReadOnlyList<ProjectMemberResult>>.NotFound("Project not found.")
            : Result<IReadOnlyList<ProjectMemberResult>>.Success(members);
    }
}

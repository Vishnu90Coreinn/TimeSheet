using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Projects.Commands;

public class CreateProjectCommandHandler(IProjectQueryService projectQueryService, IProjectRepository projectRepository)
    : IRequestHandler<CreateProjectCommand, Result<ProjectDetailResult>>
{
    public async Task<Result<ProjectDetailResult>> Handle(CreateProjectCommand request, CancellationToken cancellationToken)
    {
        if (await projectRepository.ExistsByCodeAsync(request.Code.Trim(), null, cancellationToken))
            return Result<ProjectDetailResult>.Conflict("Project code already exists.");

        var project = await projectQueryService.CreateAsync(request.Name, request.Code, request.IsActive, request.BudgetedHours, cancellationToken);
        return Result<ProjectDetailResult>.Success(project);
    }
}

public class UpdateProjectCommandHandler(IProjectQueryService projectQueryService, IProjectRepository projectRepository)
    : IRequestHandler<UpdateProjectCommand, Result>
{
    public async Task<Result> Handle(UpdateProjectCommand request, CancellationToken cancellationToken)
    {
        if (await projectRepository.ExistsByCodeAsync(request.Code.Trim(), request.Id, cancellationToken))
            return Result.Conflict("Project code already exists.");

        var updated = await projectQueryService.UpdateAsync(request.Id, request.Name, request.Code, request.IsActive, request.BudgetedHours, cancellationToken);
        return updated ? Result.Success() : Result.NotFound("Project not found.");
    }
}

public class DeleteProjectCommandHandler(IProjectQueryService projectQueryService) : IRequestHandler<DeleteProjectCommand, Result>
{
    public async Task<Result> Handle(DeleteProjectCommand request, CancellationToken cancellationToken)
        => await projectQueryService.DeleteAsync(request.Id, cancellationToken)
            ? Result.Success()
            : Result.NotFound("Project not found.");
}

public class ArchiveProjectCommandHandler(IProjectQueryService projectQueryService) : IRequestHandler<ArchiveProjectCommand, Result>
{
    public async Task<Result> Handle(ArchiveProjectCommand request, CancellationToken cancellationToken)
        => await projectQueryService.ArchiveAsync(request.Id, cancellationToken)
            ? Result.Success()
            : Result.NotFound("Project not found.");
}

public class SetProjectMembersCommandHandler(IProjectQueryService projectQueryService) : IRequestHandler<SetProjectMembersCommand, Result>
{
    public async Task<Result> Handle(SetProjectMembersCommand request, CancellationToken cancellationToken)
    {
        var outcome = await projectQueryService.SetMembersAsync(request.Id, request.UserIds, cancellationToken);
        if (!outcome.ProjectExists)
            return Result.NotFound("Project not found.");

        return outcome.AllUsersExist
            ? Result.Success()
            : Result.ValidationFailure("One or more users do not exist.");
    }
}

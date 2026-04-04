using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.TimesheetTemplates.Queries;

public class GetTimesheetTemplatesQueryHandler(ITimesheetTemplateService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetTimesheetTemplatesQuery, Result<IReadOnlyList<TimesheetTemplateResult>>>
{
    public async Task<Result<IReadOnlyList<TimesheetTemplateResult>>> Handle(GetTimesheetTemplatesQuery request, CancellationToken cancellationToken)
        => currentUserService.UserId == Guid.Empty
            ? Result<IReadOnlyList<TimesheetTemplateResult>>.Forbidden("Unauthorized.")
            : Result<IReadOnlyList<TimesheetTemplateResult>>.Success(await service.GetAllAsync(currentUserService.UserId, cancellationToken));
}

public class CreateTimesheetTemplateCommandHandler(ITimesheetTemplateService service, ICurrentUserService currentUserService)
    : IRequestHandler<CreateTimesheetTemplateCommand, Result<TimesheetTemplateResult>>
{
    public async Task<Result<TimesheetTemplateResult>> Handle(CreateTimesheetTemplateCommand request, CancellationToken cancellationToken)
        => currentUserService.UserId == Guid.Empty
            ? Result<TimesheetTemplateResult>.Forbidden("Unauthorized.")
            : Result<TimesheetTemplateResult>.Success(await service.CreateAsync(currentUserService.UserId, request.Name, request.Entries, cancellationToken));
}

public class UpdateTimesheetTemplateCommandHandler(ITimesheetTemplateService service, ICurrentUserService currentUserService)
    : IRequestHandler<UpdateTimesheetTemplateCommand, Result<TimesheetTemplateResult>>
{
    public async Task<Result<TimesheetTemplateResult>> Handle(UpdateTimesheetTemplateCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty) return Result<TimesheetTemplateResult>.Forbidden("Unauthorized.");
        var result = await service.UpdateAsync(currentUserService.UserId, request.TemplateId, request.Name, request.Entries, cancellationToken);
        return result is null ? Result<TimesheetTemplateResult>.NotFound("Template not found.") : Result<TimesheetTemplateResult>.Success(result);
    }
}

public class DeleteTimesheetTemplateCommandHandler(ITimesheetTemplateService service, ICurrentUserService currentUserService)
    : IRequestHandler<DeleteTimesheetTemplateCommand, Result>
{
    public async Task<Result> Handle(DeleteTimesheetTemplateCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty) return Result.Forbidden("Unauthorized.");
        return await service.DeleteAsync(currentUserService.UserId, request.TemplateId, cancellationToken)
            ? Result.Success()
            : Result.NotFound("Template not found.");
    }
}

public class ApplyTimesheetTemplateCommandHandler(ITimesheetTemplateService service, ICurrentUserService currentUserService)
    : IRequestHandler<ApplyTimesheetTemplateCommand, Result<TemplateApplyOutcome>>
{
    public async Task<Result<TemplateApplyOutcome>> Handle(ApplyTimesheetTemplateCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty) return Result<TemplateApplyOutcome>.Forbidden("Unauthorized.");
        var result = await service.ApplyAsync(currentUserService.UserId, request.TemplateId, request.WorkDate, cancellationToken);
        return result.Outcome switch
        {
            TemplateApplyOutcomeType.Success => Result<TemplateApplyOutcome>.Success(result),
            TemplateApplyOutcomeType.TemplateNotFound => Result<TemplateApplyOutcome>.NotFound("Template not found."),
            TemplateApplyOutcomeType.TimesheetLocked => Result<TemplateApplyOutcome>.ValidationFailure("Cannot apply to a locked timesheet"),
            _ => Result<TemplateApplyOutcome>.Failure("Template apply failed.")
        };
    }
}

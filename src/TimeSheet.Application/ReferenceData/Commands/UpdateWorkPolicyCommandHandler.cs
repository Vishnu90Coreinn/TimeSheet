using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Commands;

public class UpdateWorkPolicyCommandHandler(IWorkPolicyRepository workPolicyRepository, IUnitOfWork unitOfWork)
    : IRequestHandler<UpdateWorkPolicyCommand, Result<WorkPolicyMutationResult>>
{
    public async Task<Result<WorkPolicyMutationResult>> Handle(UpdateWorkPolicyCommand request, CancellationToken cancellationToken)
    {
        var policy = await workPolicyRepository.GetByIdAsync(request.Id, cancellationToken);
        if (policy is null) return Result<WorkPolicyMutationResult>.NotFound("Work policy not found.");

        if (await workPolicyRepository.ExistsAsync(request.Name, request.Id, cancellationToken))
            return Result<WorkPolicyMutationResult>.Conflict("A work policy with that name already exists.");

        policy.Name = request.Name.Trim();
        policy.DailyExpectedMinutes = request.DailyExpectedMinutes;
        policy.WorkDaysPerWeek = request.WorkDaysPerWeek is >= 5 and <= 6 ? request.WorkDaysPerWeek : 5;
        policy.IsActive = request.IsActive;

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<WorkPolicyMutationResult>.Success(
            new WorkPolicyMutationResult(policy.Id, policy.Name, policy.DailyExpectedMinutes, policy.WorkDaysPerWeek, policy.IsActive));
    }
}

using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Commands;

public class CreateWorkPolicyCommandHandler(IWorkPolicyRepository workPolicyRepository, IUnitOfWork unitOfWork)
    : IRequestHandler<CreateWorkPolicyCommand, Result<WorkPolicyMutationResult>>
{
    public async Task<Result<WorkPolicyMutationResult>> Handle(CreateWorkPolicyCommand request, CancellationToken cancellationToken)
    {
        if (await workPolicyRepository.ExistsAsync(request.Name, null, cancellationToken))
            return Result<WorkPolicyMutationResult>.Conflict("Work policy already exists.");

        var policy = new WorkPolicy
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            DailyExpectedMinutes = request.DailyExpectedMinutes,
            WorkDaysPerWeek = request.WorkDaysPerWeek is >= 5 and <= 6 ? request.WorkDaysPerWeek : 5,
            IsActive = request.IsActive
        };

        workPolicyRepository.Add(policy);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<WorkPolicyMutationResult>.Success(
            new WorkPolicyMutationResult(policy.Id, policy.Name, policy.DailyExpectedMinutes, policy.WorkDaysPerWeek, policy.IsActive));
    }
}

using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Commands;

public class CreateWorkPolicyCommandHandler(
    IWorkPolicyRepository workPolicyRepository,
    IOvertimePolicyRepository overtimePolicyRepository,
    IUnitOfWork unitOfWork)
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

        overtimePolicyRepository.Add(new OvertimePolicy
        {
            Id = Guid.NewGuid(),
            WorkPolicyId = policy.Id,
            DailyOvertimeAfterHours = request.DailyOvertimeAfterHours,
            WeeklyOvertimeAfterHours = request.WeeklyOvertimeAfterHours,
            OvertimeMultiplier = request.OvertimeMultiplier,
            CompOffEnabled = request.CompOffEnabled,
            CompOffExpiryDays = request.CompOffExpiryDays
        });

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<WorkPolicyMutationResult>.Success(
            new WorkPolicyMutationResult(
                policy.Id,
                policy.Name,
                policy.DailyExpectedMinutes,
                policy.WorkDaysPerWeek,
                policy.IsActive,
                request.DailyOvertimeAfterHours,
                request.WeeklyOvertimeAfterHours,
                request.OvertimeMultiplier,
                request.CompOffEnabled,
                request.CompOffExpiryDays));
    }
}

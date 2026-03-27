using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Queries;

public class GetWorkPoliciesQueryHandler(
    IWorkPolicyRepository workPolicyRepository,
    IOvertimePolicyRepository overtimePolicyRepository)
    : IRequestHandler<GetWorkPoliciesQuery, Result<List<WorkPolicyResult>>>
{
    public async Task<Result<List<WorkPolicyResult>>> Handle(GetWorkPoliciesQuery request, CancellationToken cancellationToken)
    {
        var policies = await workPolicyRepository.GetAllAsync(cancellationToken);
        var overtimeByPolicy = await overtimePolicyRepository.GetByWorkPolicyIdsAsync(policies.Select(p => p.Id), cancellationToken);
        var result = policies
            .OrderBy(w => w.Name)
            .Select(w =>
            {
                overtimeByPolicy.TryGetValue(w.Id, out var overtime);
                return new WorkPolicyResult(
                    w.Id,
                    w.Name,
                    w.DailyExpectedMinutes,
                    w.WorkDaysPerWeek,
                    w.IsActive,
                    overtime?.DailyOvertimeAfterHours ?? 8m,
                    overtime?.WeeklyOvertimeAfterHours ?? 40m,
                    overtime?.OvertimeMultiplier ?? 1.5m,
                    overtime?.CompOffEnabled ?? false,
                    overtime?.CompOffExpiryDays ?? 90);
            })
            .ToList();
        return Result<List<WorkPolicyResult>>.Success(result);
    }
}

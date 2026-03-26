using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Queries;

public class GetWorkPoliciesQueryHandler(IWorkPolicyRepository workPolicyRepository)
    : IRequestHandler<GetWorkPoliciesQuery, Result<List<WorkPolicyResult>>>
{
    public async Task<Result<List<WorkPolicyResult>>> Handle(GetWorkPoliciesQuery request, CancellationToken cancellationToken)
    {
        var policies = await workPolicyRepository.GetAllAsync(cancellationToken);
        var result = policies
            .OrderBy(w => w.Name)
            .Select(w => new WorkPolicyResult(w.Id, w.Name, w.DailyExpectedMinutes, w.WorkDaysPerWeek, w.IsActive))
            .ToList();
        return Result<List<WorkPolicyResult>>.Success(result);
    }
}

using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Queries;

public record GetWorkPoliciesQuery : IRequest<Result<List<WorkPolicyResult>>>;

public record WorkPolicyResult(Guid Id, string Name, int DailyExpectedMinutes, int WorkDaysPerWeek, bool IsActive);

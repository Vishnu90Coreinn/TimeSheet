using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Commands;

public record UpdateWorkPolicyCommand(Guid Id, string Name, int DailyExpectedMinutes, int WorkDaysPerWeek, bool IsActive)
    : IRequest<Result<WorkPolicyMutationResult>>;

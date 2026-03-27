using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Commands;

public record UpdateWorkPolicyCommand(
    Guid Id,
    string Name,
    int DailyExpectedMinutes,
    int WorkDaysPerWeek,
    bool IsActive,
    decimal DailyOvertimeAfterHours,
    decimal WeeklyOvertimeAfterHours,
    decimal OvertimeMultiplier,
    bool CompOffEnabled,
    int CompOffExpiryDays)
    : IRequest<Result<WorkPolicyMutationResult>>;

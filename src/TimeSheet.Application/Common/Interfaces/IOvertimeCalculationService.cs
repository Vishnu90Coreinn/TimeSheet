namespace TimeSheet.Application.Common.Interfaces;

public interface IOvertimeCalculationService
{
    Task<OvertimeCalculationResult> CalculateUserWeekAsync(Guid userId, DateOnly weekStart, bool approvedOnly, CancellationToken ct = default);
    Task<decimal> CalculateTeamOvertimeHoursAsync(Guid managerUserId, DateOnly weekStart, CancellationToken ct = default);
}

public record OvertimeCalculationResult(decimal RegularHours, decimal OvertimeHours, decimal CompOffCredits);


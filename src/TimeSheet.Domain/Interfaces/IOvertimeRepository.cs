namespace TimeSheet.Domain.Interfaces;

public interface IOvertimeRepository
{
    Task<OvertimeUserPolicyRow?> GetUserPolicyAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<OvertimeDayHoursRow>> GetDayHoursAsync(Guid userId, DateOnly weekStart, DateOnly weekEnd, bool approvedOnly, CancellationToken ct = default);
    Task<IReadOnlyList<Guid>> GetActiveTeamUserIdsAsync(Guid managerUserId, CancellationToken ct = default);
}

public record OvertimeUserPolicyRow(decimal DailyThreshold, decimal WeeklyThreshold, decimal Multiplier, bool CompOffEnabled);
public record OvertimeDayHoursRow(DateOnly WorkDate, decimal Hours);

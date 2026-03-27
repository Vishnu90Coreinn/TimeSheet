namespace TimeSheet.Application.Common.Interfaces;

public interface IOnboardingQueryService
{
    Task<OnboardingChecklistResult> GetChecklistAsync(Guid userId, string role, CancellationToken ct = default);
}

public record OnboardingChecklistResult(
    bool HasSubmittedTimesheet,
    bool HasAppliedLeave,
    bool HasVisitedLeaveWorkflow,
    bool HasSetTimezone,
    bool HasSetNotificationPrefs,
    bool AdminHasProject,
    bool AdminHasLeavePolicy,
    bool AdminHasHoliday,
    bool AdminHasUser);

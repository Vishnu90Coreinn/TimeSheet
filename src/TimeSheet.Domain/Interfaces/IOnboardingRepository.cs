namespace TimeSheet.Domain.Interfaces;

public interface IOnboardingRepository
{
    Task<OnboardingChecklistRow?> GetChecklistAsync(Guid userId, bool isAdmin, CancellationToken ct = default);
}

public record OnboardingChecklistRow(
    bool HasSubmittedTimesheet,
    bool HasAppliedLeave,
    bool HasVisitedLeaveWorkflow,
    bool HasSetTimezone,
    bool HasSetNotificationPrefs,
    bool AdminHasProject,
    bool AdminHasLeavePolicy,
    bool AdminHasHoliday,
    bool AdminHasUser);

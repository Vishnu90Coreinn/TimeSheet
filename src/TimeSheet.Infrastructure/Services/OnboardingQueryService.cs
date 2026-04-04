using TimeSheet.Domain.Interfaces;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class OnboardingQueryService(IOnboardingRepository onboardingRepository) : AppInterfaces.IOnboardingQueryService
{
    public async Task<AppInterfaces.OnboardingChecklistResult> GetChecklistAsync(Guid userId, string role, CancellationToken ct = default)
    {
        var row = await onboardingRepository.GetChecklistAsync(
            userId,
            string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase),
            ct);

        return row is null
            ? new AppInterfaces.OnboardingChecklistResult(false, false, false, false, false, false, false, false, false)
            : new AppInterfaces.OnboardingChecklistResult(
                row.HasSubmittedTimesheet,
                row.HasAppliedLeave,
                row.HasVisitedLeaveWorkflow,
                row.HasSetTimezone,
                row.HasSetNotificationPrefs,
                row.AdminHasProject,
                row.AdminHasLeavePolicy,
                row.AdminHasHoliday,
                row.AdminHasUser);
    }
}

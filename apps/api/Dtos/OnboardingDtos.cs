namespace TimeSheet.Api.Dtos;

public record OnboardingChecklistResponse(
    bool HasSubmittedTimesheet,
    bool HasAppliedLeave,
    bool HasVisitedLeaveWorkflow,
    bool HasSetTimezone,
    bool HasSetNotificationPrefs,
    bool AdminHasProject,
    bool AdminHasLeavePolicy,
    bool AdminHasHoliday,
    bool AdminHasUser);

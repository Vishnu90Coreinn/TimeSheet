using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Enums;
using TimeSheet.Infrastructure.Persistence;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class OnboardingQueryService(TimeSheetDbContext context) : AppInterfaces.IOnboardingQueryService
{
    public async Task<AppInterfaces.OnboardingChecklistResult> GetChecklistAsync(Guid userId, string role, CancellationToken ct = default)
    {
        var user = await context.Users
            .AsNoTracking()
            .SingleAsync(u => u.Id == userId, ct);

        var hasSubmittedTimesheet = await context.Timesheets
            .AsNoTracking()
            .AnyAsync(t => t.UserId == userId && t.Status != TimesheetStatus.Draft, ct);

        var hasAppliedLeave = await context.LeaveRequests
            .AsNoTracking()
            .AnyAsync(l => l.UserId == userId, ct);

        var hasVisitedLeaveWorkflow = user.LeaveWorkflowVisitedAt.HasValue;

        var hasSetTimezone = !string.IsNullOrWhiteSpace(user.TimeZoneId)
            && !string.Equals(user.TimeZoneId, "UTC", StringComparison.OrdinalIgnoreCase);

        var prefs = await context.UserNotificationPreferences
            .AsNoTracking()
            .SingleOrDefaultAsync(p => p.UserId == userId, ct);

        var hasSetNotificationPrefs = prefs is not null;

        var isAdmin = string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);

        var adminHasProject = !isAdmin || await context.Projects.AsNoTracking().AnyAsync(p => !p.IsArchived, ct);
        var adminHasLeavePolicy = !isAdmin || await context.LeavePolicies.AsNoTracking().AnyAsync(lp => lp.IsActive, ct);
        var adminHasHoliday = !isAdmin || await context.Holidays.AsNoTracking().AnyAsync(ct);
        var adminHasUser = !isAdmin || await context.Users.AsNoTracking().AnyAsync(u => u.Id != userId, ct);

        return new AppInterfaces.OnboardingChecklistResult(
            hasSubmittedTimesheet,
            hasAppliedLeave,
            hasVisitedLeaveWorkflow,
            hasSetTimezone,
            hasSetNotificationPrefs,
            adminHasProject,
            adminHasLeavePolicy,
            adminHasHoliday,
            adminHasUser);
    }
}

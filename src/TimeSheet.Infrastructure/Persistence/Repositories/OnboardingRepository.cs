using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class OnboardingRepository(TimeSheetDbContext context) : IOnboardingRepository
{
    public async Task<OnboardingChecklistRow?> GetChecklistAsync(Guid userId, bool isAdmin, CancellationToken ct = default)
    {
        var user = await context.Users
            .AsNoTracking()
            .Select(u => new { u.Id, u.LeaveWorkflowVisitedAt, u.TimeZoneId })
            .SingleOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return null;

        var hasSubmittedTimesheet = await context.Timesheets.AsNoTracking().AnyAsync(t => t.UserId == userId && t.Status != TimesheetStatus.Draft, ct);
        var hasAppliedLeave = await context.LeaveRequests.AsNoTracking().AnyAsync(l => l.UserId == userId, ct);
        var hasSetNotificationPrefs = await context.UserNotificationPreferences.AsNoTracking().AnyAsync(p => p.UserId == userId, ct);

        var adminHasProject = !isAdmin || await context.Projects.AsNoTracking().AnyAsync(p => !p.IsArchived, ct);
        var adminHasLeavePolicy = !isAdmin || await context.LeavePolicies.AsNoTracking().AnyAsync(lp => lp.IsActive, ct);
        var adminHasHoliday = !isAdmin || await context.Holidays.AsNoTracking().AnyAsync(ct);
        var adminHasUser = !isAdmin || await context.Users.AsNoTracking().AnyAsync(u => u.Id != userId, ct);

        return new OnboardingChecklistRow(
            hasSubmittedTimesheet,
            hasAppliedLeave,
            user.LeaveWorkflowVisitedAt.HasValue,
            !string.IsNullOrWhiteSpace(user.TimeZoneId) && !string.Equals(user.TimeZoneId, "UTC", StringComparison.OrdinalIgnoreCase),
            hasSetNotificationPrefs,
            adminHasProject,
            adminHasLeavePolicy,
            adminHasHoliday,
            adminHasUser);
    }
}

using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class DashboardRepository(TimeSheetDbContext dbContext) : IDashboardRepository
{
    public async Task<EmployeeDashboardReadModel> GetEmployeeDashboardAsync(Guid userId, DateOnly today, DateOnly weekStart, CancellationToken ct = default)
    {
        var todaySession = await dbContext.WorkSessions.AsNoTracking()
            .Where(x => x.UserId == userId && x.WorkDate == today)
            .OrderByDescending(x => x.CheckInAtUtc)
            .Select(x => new EmployeeTodaySessionReadModel(
                x.WorkDate,
                x.CheckInAtUtc,
                x.CheckOutAtUtc,
                x.Breaks.Sum(b => b.DurationMinutes),
                (x.CheckOutAtUtc.HasValue ? (int)(x.CheckOutAtUtc.Value - x.CheckInAtUtc).TotalMinutes : 0) - x.Breaks.Sum(b => b.DurationMinutes)))
            .FirstOrDefaultAsync(ct);

        var todayTimesheet = await dbContext.Timesheets.AsNoTracking()
            .Where(x => x.UserId == userId && x.WorkDate == today)
            .OrderBy(x => x.WorkDate)
            .Select(x => new EmployeeTodayTimesheetDbRow(
                x.Status,
                x.MismatchReason,
                x.Entries.Sum(e => e.Minutes),
                x.Status == TimesheetStatus.Draft ? 1 : 0))
            .FirstOrDefaultAsync(ct);

        var weekEnteredMinutes = await dbContext.TimesheetEntries.AsNoTracking()
            .Where(e => e.Timesheet.UserId == userId && e.Timesheet.WorkDate >= weekStart && e.Timesheet.WorkDate <= weekStart.AddDays(6))
            .SumAsync(e => (int?)e.Minutes, ct) ?? 0;
        var weekBreakMinutes = await dbContext.WorkSessions.AsNoTracking()
            .Where(ws => ws.UserId == userId && ws.WorkDate >= weekStart && ws.WorkDate <= weekStart.AddDays(6))
            .SumAsync(ws => (int?)ws.Breaks.Sum(b => b.DurationMinutes), ct) ?? 0;

        var projectEffortRows = await dbContext.TimesheetEntries.AsNoTracking()
            .Where(x => x.Timesheet.UserId == userId && x.Timesheet.WorkDate >= weekStart && x.Timesheet.WorkDate <= weekStart.AddDays(6))
            .Select(x => new { ProjectName = x.Project.Name, x.Minutes })
            .ToListAsync(ct);

        var projectEffort = projectEffortRows
            .GroupBy(x => x.ProjectName)
            .Select(g => new EmployeeProjectEffortReadModel(g.Key, g.Sum(x => x.Minutes)))
            .OrderByDescending(x => x.Minutes)
            .ToList();

        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var complianceRows = await dbContext.Timesheets.AsNoTracking()
            .Where(x => x.UserId == userId && x.WorkDate >= monthStart)
            .Select(x => new { x.WorkDate, x.Status })
            .ToListAsync(ct);

        var complianceTrend = complianceRows
            .GroupBy(x => x.WorkDate)
            .Select(g => new EmployeeComplianceTrendReadModel(
                g.Key,
                g.All(x => x.Status == TimesheetStatus.Approved || x.Status == TimesheetStatus.Submitted)))
            .OrderBy(x => x.WorkDate)
            .ToList();

        return new EmployeeDashboardReadModel(
            todaySession ?? new EmployeeTodaySessionReadModel(today, null, null, 0, 0),
            todayTimesheet is null
                ? new EmployeeTodayTimesheetReadModel(TimesheetStatus.Draft.ToString(), null, 0, 1)
                : new EmployeeTodayTimesheetReadModel(
                    todayTimesheet.Status.ToString(),
                    todayTimesheet.MismatchReason,
                    todayTimesheet.EnteredMinutes,
                    todayTimesheet.DraftCount),
            new EmployeeWeeklyHoursReadModel(weekEnteredMinutes, weekBreakMinutes),
            projectEffort,
            complianceTrend);
    }

    public async Task<ManagerDashboardReadModel> GetManagerDashboardAsync(Guid userId, DateOnly today, CancellationToken ct = default)
    {
        var teamIds = await dbContext.Users.AsNoTracking().Where(x => x.ManagerId == userId).Select(x => x.Id).ToListAsync(ct);
        if (teamIds.Count == 0)
        {
            return new ManagerDashboardReadModel(
                new ManagerTeamAttendanceReadModel(0, 0, 0),
                new ManagerTimesheetHealthReadModel(0, 0),
                [],
                new ManagerUtilizationReadModel(0),
                []);
        }

        var presentUserIds = await dbContext.WorkSessions.AsNoTracking()
            .Where(x => teamIds.Contains(x.UserId) && x.WorkDate == today)
            .Select(x => x.UserId)
            .Distinct()
            .ToListAsync(ct);
        var onLeaveUserIds = await dbContext.LeaveRequests.AsNoTracking()
            .Where(x => teamIds.Contains(x.UserId) && x.LeaveDate == today && x.Status == LeaveRequestStatus.Approved)
            .Select(x => x.UserId)
            .Distinct()
            .ToListAsync(ct);

        var missing = await dbContext.Users.CountAsync(x => teamIds.Contains(x.Id) && !x.Timesheets.Any(t => t.WorkDate == today), ct);
        var pendingApprovals = await dbContext.Timesheets.CountAsync(x => teamIds.Contains(x.UserId) && x.Status == TimesheetStatus.Submitted, ct);

        var mismatches = await dbContext.Timesheets.AsNoTracking()
            .Where(x => teamIds.Contains(x.UserId) && !string.IsNullOrWhiteSpace(x.MismatchReason))
            .OrderByDescending(x => x.WorkDate)
            .Take(10)
            .Select(x => new ManagerMismatchReadModel(x.User.Username, x.WorkDate, x.MismatchReason))
            .ToListAsync(ct);

        var avgMinutes = await dbContext.Timesheets.AsNoTracking()
            .Where(x => teamIds.Contains(x.UserId) && x.WorkDate >= today.AddDays(-7))
            .AverageAsync(x => (double?)x.Entries.Sum(e => e.Minutes), ct) ?? 0d;

        var contributionRows = await dbContext.TimesheetEntries.AsNoTracking()
            .Where(x => teamIds.Contains(x.Timesheet.UserId) && x.Timesheet.WorkDate >= today.AddDays(-7))
            .Select(x => new { ProjectName = x.Project.Name, x.Minutes })
            .ToListAsync(ct);

        var contributions = contributionRows
            .GroupBy(x => x.ProjectName)
            .Select(g => new ManagerContributionReadModel(g.Key, g.Sum(x => x.Minutes)))
            .OrderByDescending(x => x.Minutes)
            .Take(10)
            .ToList();

        return new ManagerDashboardReadModel(
            new ManagerTeamAttendanceReadModel(presentUserIds.Except(onLeaveUserIds).Count(), onLeaveUserIds.Count, teamIds.Except(presentUserIds).Except(onLeaveUserIds).Count()),
            new ManagerTimesheetHealthReadModel(missing, pendingApprovals),
            mismatches,
            new ManagerUtilizationReadModel(avgMinutes),
            contributions);
    }

    public async Task<ManagementDashboardReadModel> GetManagementDashboardAsync(DateOnly today, DateOnly fromDate, CancellationToken ct = default)
    {
        var effortByDepartment = await dbContext.TimesheetEntries.AsNoTracking()
            .Where(x => x.Timesheet.WorkDate >= fromDate)
            .GroupBy(x => x.Timesheet.User.Department != null ? x.Timesheet.User.Department.Name : "Unassigned")
            .Select(g => new ManagementEffortByDepartmentReadModel(g.Key, g.Sum(x => x.Minutes)))
            .ToListAsync(ct);

        var effortByProject = await dbContext.TimesheetEntries.AsNoTracking()
            .Where(x => x.Timesheet.WorkDate >= fromDate)
            .GroupBy(x => x.Project.Name)
            .Select(g => new ManagementEffortByProjectReadModel(g.Key, g.Sum(x => x.Minutes)))
            .ToListAsync(ct);

        var billableCategoryIds = await dbContext.TaskCategories.Where(c => c.IsBillable).Select(c => c.Id).ToListAsync(ct);
        var billableMinutes = await dbContext.TimesheetEntries.Where(x => billableCategoryIds.Contains(x.TaskCategoryId) && x.Timesheet.WorkDate >= fromDate).SumAsync(x => x.Minutes, ct);
        var totalMinutes = await dbContext.TimesheetEntries.Where(x => x.Timesheet.WorkDate >= fromDate).SumAsync(x => x.Minutes, ct);

        var consultantVsInternal = new ManagementConsultantVsInternalReadModel(
            await dbContext.Users.CountAsync(x => x.Email.EndsWith("@consultant.local"), ct),
            await dbContext.Users.CountAsync(x => !x.Email.EndsWith("@consultant.local"), ct));

        var userLoad = await dbContext.Users.AsNoTracking()
            .Where(x => x.IsActive)
            .Select(x => new
            {
                x.Username,
                Minutes = x.Timesheets.Where(t => t.WorkDate >= fromDate).Sum(t => t.Entries.Sum(e => e.Minutes))
            })
            .ToListAsync(ct);

        var underOver = userLoad.Select(x => new ManagementUnderOverReadModel(
            x.Username,
            x.Minutes < 8 * 60 * 10 ? "underutilized" : x.Minutes > 8 * 60 * 25 ? "overloaded" : "balanced",
            x.Minutes)).ToList();

        var compliance = await dbContext.Timesheets.AsNoTracking()
            .Where(x => x.WorkDate >= fromDate)
            .GroupBy(x => x.WorkDate)
            .Select(g => new ManagementComplianceReadModel(
                g.Key,
                dbContext.Users.Count(u => u.IsActive) - g.Select(x => x.UserId).Distinct().Count(),
                g.Count(x => x.Entries.Sum(e => e.Minutes) > 8 * 60),
                g.Count(x => x.Status == TimesheetStatus.Draft || x.Status == TimesheetStatus.Rejected)))
            .ToListAsync(ct);

        return new ManagementDashboardReadModel(
            effortByDepartment,
            effortByProject,
            new ManagementBillableReadModel(billableMinutes, Math.Max(0, totalMinutes - billableMinutes)),
            consultantVsInternal,
            underOver,
            compliance);
    }

    private sealed record EmployeeTodayTimesheetDbRow(
        TimesheetStatus Status,
        string? MismatchReason,
        int EnteredMinutes,
        int DraftCount);
}

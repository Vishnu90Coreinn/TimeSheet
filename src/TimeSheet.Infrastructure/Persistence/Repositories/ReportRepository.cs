using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class ReportRepository(TimeSheetDbContext dbContext) : IReportRepository
{
    public async Task<List<Guid>> GetScopedUserIdsAsync(
        Guid requesterUserId,
        string requesterRole,
        Guid? filterUserId,
        Guid? departmentId,
        CancellationToken ct = default)
    {
        IQueryable<User> users = dbContext.Users.AsNoTracking().Where(u => u.IsActive);
        if (departmentId.HasValue)
            users = users.Where(u => u.DepartmentId == departmentId.Value);

        if (string.Equals(requesterRole, "admin", StringComparison.OrdinalIgnoreCase))
        {
            if (filterUserId.HasValue)
                users = users.Where(u => u.Id == filterUserId.Value);
            return await users.Select(u => u.Id).ToListAsync(ct);
        }

        if (string.Equals(requesterRole, "manager", StringComparison.OrdinalIgnoreCase))
        {
            var teamIds = await dbContext.Users.AsNoTracking()
                .Where(u => u.ManagerId == requesterUserId || u.Id == requesterUserId)
                .Select(u => u.Id)
                .ToListAsync(ct);
            users = users.Where(u => teamIds.Contains(u.Id));
            if (filterUserId.HasValue)
                users = users.Where(u => u.Id == filterUserId.Value);
            return await users.Select(u => u.Id).ToListAsync(ct);
        }

        return await users.Where(u => u.Id == requesterUserId).Select(u => u.Id).ToListAsync(ct);
    }

    public async Task<(IReadOnlyList<AttendanceSummaryReportRow> Items, int TotalCount, int Page)> GetAttendanceSummaryPageAsync(
        IReadOnlyCollection<Guid> userIds,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = dbContext.WorkSessions.AsNoTracking().Where(x => userIds.Contains(x.UserId));
        if (fromDate.HasValue) query = query.Where(x => x.WorkDate >= fromDate.Value);
        if (toDate.HasValue) query = query.Where(x => x.WorkDate <= toDate.Value);

        var ordered = query.OrderByDescending(x => x.WorkDate);
        var totalCount = await ordered.CountAsync(ct);
        var safePage = GetSafePage(totalCount, page, pageSize);
        var items = await ordered
            .Skip((safePage - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AttendanceSummaryReportRow(
                x.UserId,
                x.User.Username,
                x.WorkDate,
                (x.CheckOutAtUtc.HasValue ? (int)(x.CheckOutAtUtc.Value - x.CheckInAtUtc).TotalMinutes : 0) - x.Breaks.Sum(b => b.DurationMinutes),
                x.Breaks.Sum(b => b.DurationMinutes),
                x.HasAttendanceException))
            .ToListAsync(ct);

        return (items, totalCount, safePage);
    }

    public async Task<(IReadOnlyList<TimesheetSummaryReportRow> Items, int TotalCount, int Page)> GetTimesheetSummaryPageAsync(
        IReadOnlyCollection<Guid> userIds,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = dbContext.Timesheets.AsNoTracking().Where(x => userIds.Contains(x.UserId));
        if (fromDate.HasValue) query = query.Where(x => x.WorkDate >= fromDate.Value);
        if (toDate.HasValue) query = query.Where(x => x.WorkDate <= toDate.Value);

        var ordered = query.OrderByDescending(x => x.WorkDate);
        var totalCount = await ordered.CountAsync(ct);
        var safePage = GetSafePage(totalCount, page, pageSize);
        var items = await ordered
            .Skip((safePage - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new TimesheetSummaryDbRow(
                x.UserId,
                x.User.Username,
                x.WorkDate,
                x.Status,
                x.Entries.Sum(e => e.Minutes),
                dbContext.WorkSessions.Where(ws => ws.UserId == x.UserId && ws.WorkDate == x.WorkDate)
                    .Select(ws => (ws.CheckOutAtUtc.HasValue ? (int)(ws.CheckOutAtUtc.Value - ws.CheckInAtUtc).TotalMinutes : 0) - ws.Breaks.Sum(b => b.DurationMinutes))
                    .FirstOrDefault(),
                !string.IsNullOrWhiteSpace(x.MismatchReason)))
            .ToListAsync(ct);

        return (items.Select(x => new TimesheetSummaryReportRow(
            x.UserId,
            x.Username,
            x.WorkDate,
            x.Status.ToString(),
            x.EnteredMinutes,
            x.AttendedMinutes,
            x.HasMismatch)).ToList(), totalCount, safePage);
    }

    public async Task<(IReadOnlyList<ProjectEffortReportRow> Items, int TotalCount, int Page)> GetProjectEffortPageAsync(
        IReadOnlyCollection<Guid> userIds,
        DateOnly? fromDate,
        DateOnly? toDate,
        Guid? projectId,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = dbContext.TimesheetEntries.AsNoTracking().Where(x => userIds.Contains(x.Timesheet.UserId));
        if (projectId.HasValue) query = query.Where(x => x.ProjectId == projectId.Value);
        if (fromDate.HasValue) query = query.Where(x => x.Timesheet.WorkDate >= fromDate.Value);
        if (toDate.HasValue) query = query.Where(x => x.Timesheet.WorkDate <= toDate.Value);

        var groups = query.GroupBy(x => new { x.ProjectId, x.Project.Name, x.Project.Code });
        var totalCount = await groups.CountAsync(ct);
        var safePage = GetSafePage(totalCount, page, pageSize);
        var items = await groups.OrderByDescending(x => x.Sum(y => y.Minutes))
            .Skip((safePage - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new ProjectEffortReportRow(
                x.Key.ProjectId,
                x.Key.Name,
                x.Key.Code,
                x.Sum(y => y.Minutes),
                x.Select(y => y.Timesheet.UserId).Distinct().Count()))
            .ToListAsync(ct);

        return (items, totalCount, safePage);
    }

    public async Task<(IReadOnlyList<LeaveUtilizationReportRow> Items, int TotalCount, int Page)> GetLeaveUtilizationPageAsync(
        IReadOnlyCollection<Guid> userIds,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var resolvedFromDate = fromDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
        var resolvedToDate = toDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var usersQuery = dbContext.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .OrderBy(u => u.Username)
            .Select(u => new { u.Id, u.Username });

        var totalCount = await usersQuery.CountAsync(ct);
        var safePage = GetSafePage(totalCount, page, pageSize);
        var pagedUsers = await usersQuery
            .Skip((safePage - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
        var pagedUserIds = pagedUsers.Select(u => u.Id).ToList();

        var leaveCounts = await dbContext.LeaveRequests.AsNoTracking()
            .Where(x => pagedUserIds.Contains(x.UserId) && x.Status == LeaveRequestStatus.Approved && x.LeaveDate >= resolvedFromDate && x.LeaveDate <= resolvedToDate)
            .GroupBy(x => new { x.UserId, x.IsHalfDay })
            .Select(g => new { g.Key.UserId, g.Key.IsHalfDay, Count = g.Count() })
            .ToListAsync(ct);
        var leaveCountLookup = leaveCounts.ToDictionary(x => (x.UserId, x.IsHalfDay), x => x.Count);

        var timesheetMinutes = await dbContext.Timesheets.AsNoTracking()
            .Where(x => pagedUserIds.Contains(x.UserId) && x.WorkDate >= resolvedFromDate && x.WorkDate <= resolvedToDate)
            .GroupBy(x => x.UserId)
            .Select(g => new { UserId = g.Key, Minutes = g.Sum(t => t.Entries.Sum(e => e.Minutes)) })
            .ToListAsync(ct);
        var timesheetMinutesLookup = timesheetMinutes.ToDictionary(x => x.UserId, x => x.Minutes);

        var potentialMinutes = Math.Max(1, ((resolvedToDate.DayNumber - resolvedFromDate.DayNumber) + 1) * 8 * 60);
        var items = pagedUsers.Select(user =>
        {
            var fullDays = leaveCountLookup.GetValueOrDefault((user.Id, false), 0);
            var halfDays = leaveCountLookup.GetValueOrDefault((user.Id, true), 0);
            var minutes = timesheetMinutesLookup.GetValueOrDefault(user.Id, 0);
            return new LeaveUtilizationReportRow(user.Id, user.Username, fullDays, halfDays, minutes, Math.Round(minutes * 100m / potentialMinutes, 2));
        }).ToList();

        return (items, totalCount, safePage);
    }

    public async Task<(IReadOnlyList<LeaveBalanceReportRow> Items, int TotalCount, int Page)> GetLeaveBalancePageAsync(
        IReadOnlyCollection<Guid> userIds,
        int year,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var yearStart = new DateOnly(year, 1, 1);
        var yearEnd = new DateOnly(year, 12, 31);

        var usedLeave = dbContext.LeaveRequests.AsNoTracking()
            .Where(lr => userIds.Contains(lr.UserId) && lr.Status == LeaveRequestStatus.Approved && lr.LeaveDate >= yearStart && lr.LeaveDate <= yearEnd)
            .GroupBy(lr => new { lr.UserId, lr.LeaveTypeId })
            .Select(g => new { g.Key.UserId, g.Key.LeaveTypeId, Count = g.Count() });

        var query =
            from user in dbContext.Users.AsNoTracking()
            where userIds.Contains(user.Id) && user.LeavePolicyId != null
            join allocation in dbContext.LeavePolicyAllocations.AsNoTracking()
                on user.LeavePolicyId!.Value equals allocation.LeavePolicyId
            join usage in usedLeave
                on new { user.Id, allocation.LeaveTypeId } equals new { Id = usage.UserId, usage.LeaveTypeId } into usageGroup
            from usage in usageGroup.DefaultIfEmpty()
            orderby user.Username, allocation.LeaveType.Name
            select new LeaveBalanceReportRow(
                user.Id,
                user.Username,
                allocation.LeaveType.Name,
                allocation.DaysPerYear,
                usage != null ? usage.Count : 0,
                allocation.DaysPerYear - (usage != null ? usage.Count : 0));

        var totalCount = await query.CountAsync(ct);
        var safePage = GetSafePage(totalCount, page, pageSize);
        var items = await query
            .Skip((safePage - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
        return (items, totalCount, safePage);
    }

    public async Task<(IReadOnlyList<TimesheetApprovalStatusReportRow> Items, int TotalCount, int Page)> GetTimesheetApprovalStatusPageAsync(
        IReadOnlyCollection<Guid> userIds,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = dbContext.Timesheets.AsNoTracking().Where(x => userIds.Contains(x.UserId));
        if (fromDate.HasValue) query = query.Where(x => x.WorkDate >= fromDate.Value);
        if (toDate.HasValue) query = query.Where(x => x.WorkDate <= toDate.Value);

        var totalCount = await query.CountAsync(ct);
        var safePage = GetSafePage(totalCount, page, pageSize);

        var approverIds = await query.Where(x => x.ApprovedByUserId != null)
            .Select(x => x.ApprovedByUserId!.Value)
            .Distinct()
            .ToListAsync(ct);
        var approvers = await dbContext.Users.AsNoTracking()
            .Where(u => approverIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Username })
            .ToListAsync(ct);
        var approverLookup = approvers.ToDictionary(x => x.Id, x => x.Username);

        var rawRows = await query.OrderByDescending(x => x.WorkDate)
            .Skip((safePage - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new TimesheetApprovalStatusDbRow(
                x.UserId,
                x.User.Username,
                x.WorkDate,
                x.Entries.Sum(e => e.Minutes),
                x.Status,
                x.ApprovedByUserId,
                x.ApprovedAtUtc))
            .ToListAsync(ct);

        var items = rawRows.Select(x => new TimesheetApprovalStatusReportRow(
            x.UserId,
            x.Username,
            x.WorkDate,
            x.EnteredMinutes,
            x.Status.ToString(),
            x.ApprovedByUserId != null ? approverLookup.GetValueOrDefault(x.ApprovedByUserId.Value) : null,
            x.ApprovedAtUtc)).ToList();

        return (items, totalCount, safePage);
    }

    public async Task<(IReadOnlyList<OvertimeDeficitReportRow> Items, int TotalCount, int Page)> GetOvertimeDeficitPageAsync(
        IReadOnlyCollection<Guid> userIds,
        DateOnly? fromDate,
        DateOnly? toDate,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var resolvedFromDate = fromDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-28));
        var resolvedToDate = toDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var timesheets = await dbContext.Timesheets.AsNoTracking()
            .Where(x => userIds.Contains(x.UserId) && x.WorkDate >= resolvedFromDate && x.WorkDate <= resolvedToDate)
            .Select(x => new OvertimeTimesheetDbRow(
                x.UserId,
                x.User.Username,
                x.WorkDate,
                x.Entries.Sum(e => e.Minutes),
                x.User.WorkPolicy != null ? x.User.WorkPolicy.DailyExpectedMinutes : 480))
            .ToListAsync(ct);

        static DateOnly GetWeekStart(DateOnly date)
        {
            var dow = (int)date.DayOfWeek;
            return date.AddDays(dow == 0 ? -6 : -(dow - 1));
        }

        var ordered = timesheets
            .GroupBy(t => new { t.UserId, WeekStart = GetWeekStart(t.WorkDate) })
            .Select(g =>
            {
                var logged = g.Sum(t => t.LoggedMinutes);
                var workDays = g.Count(t => t.WorkDate.DayOfWeek != DayOfWeek.Sunday);
                var sample = g.First();
                var target = workDays * sample.DailyExpectedMinutes;
                return new OvertimeDeficitReportRow(g.Key.UserId, sample.Username, g.Key.WeekStart, target, logged, logged - target);
            })
            .OrderByDescending(r => r.WeekStart)
            .ThenBy(r => r.Username)
            .ToList();

        var totalCount = ordered.Count;
        var safePage = GetSafePage(totalCount, page, pageSize);
        var items = ordered.Skip((safePage - 1) * pageSize).Take(pageSize).ToList();
        return (items, totalCount, safePage);
    }

    private static int GetSafePage(int totalCount, int page, int pageSize)
    {
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        return page > totalPages ? totalPages : page;
    }

    private sealed record TimesheetSummaryDbRow(
        Guid UserId,
        string Username,
        DateOnly WorkDate,
        TimesheetStatus Status,
        int EnteredMinutes,
        int AttendedMinutes,
        bool HasMismatch);

    private sealed record TimesheetApprovalStatusDbRow(
        Guid UserId,
        string Username,
        DateOnly WorkDate,
        int EnteredMinutes,
        TimesheetStatus Status,
        Guid? ApprovedByUserId,
        DateTime? ApprovedAtUtc);

    private sealed record OvertimeTimesheetDbRow(
        Guid UserId,
        string Username,
        DateOnly WorkDate,
        int LoggedMinutes,
        int DailyExpectedMinutes);
}

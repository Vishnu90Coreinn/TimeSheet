using System.Globalization;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;
using TimeSheet.Api.Services;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/reports")]
public class ReportsController(TimeSheetDbContext dbContext) : ControllerBase
{
    [HttpGet("attendance-summary")]
    public async Task<IActionResult> AttendanceSummary([FromQuery] ReportFilterRequest filter)
    {
        var scope = await BuildScopeAsync(filter);
        if (scope is null) return Forbid();

        var query = dbContext.WorkSessions.AsNoTracking()
            .Where(x => scope.UserIds.Contains(x.UserId));

        if (scope.FromDate is { } fromDate) query = query.Where(x => x.WorkDate >= fromDate);
        if (scope.ToDate is { } toDate) query = query.Where(x => x.WorkDate <= toDate);

        var total = await query.CountAsync();
        // Note: The SQL projection below uses an inline formula for attendance minutes.
        // Full lunch deduction (per WorkPolicy) requires loading sessions into memory via
        // AttendanceCalculationService. This is a known limitation of the SQL projection approach.
        var rows = await query
            .OrderByDescending(x => x.WorkDate)
            .Skip((scope.Page - 1) * scope.PageSize)
            .Take(scope.PageSize)
            .Select(x => new AttendanceSummaryReportRow(
                x.UserId,
                x.User.Username,
                x.WorkDate,
                (x.CheckOutAtUtc.HasValue ? (int)(x.CheckOutAtUtc.Value - x.CheckInAtUtc).TotalMinutes : 0) - x.Breaks.Sum(b => b.DurationMinutes),
                x.Breaks.Sum(b => b.DurationMinutes),
                x.HasAttendanceException))
            .ToListAsync();

        return Ok(new PagedReportResponse<AttendanceSummaryReportRow>(scope.Page, scope.PageSize, total, rows));
    }

    [HttpGet("timesheet-summary")]
    public async Task<IActionResult> TimesheetSummary([FromQuery] ReportFilterRequest filter)
    {
        var scope = await BuildScopeAsync(filter);
        if (scope is null) return Forbid();

        var query = dbContext.Timesheets.AsNoTracking().Where(x => scope.UserIds.Contains(x.UserId));
        if (scope.FromDate is { } fromDate) query = query.Where(x => x.WorkDate >= fromDate);
        if (scope.ToDate is { } toDate) query = query.Where(x => x.WorkDate <= toDate);

        var total = await query.CountAsync();
        var rows = await query
            .OrderByDescending(x => x.WorkDate)
            .Skip((scope.Page - 1) * scope.PageSize)
            .Take(scope.PageSize)
            .Select(x => new TimesheetSummaryReportRow(
                x.UserId,
                x.User.Username,
                x.WorkDate,
                x.Status.ToString(),
                x.Entries.Sum(e => e.Minutes),
                dbContext.WorkSessions.Where(ws => ws.UserId == x.UserId && ws.WorkDate == x.WorkDate)
                    .Select(ws => (ws.CheckOutAtUtc.HasValue ? (int)(ws.CheckOutAtUtc.Value - ws.CheckInAtUtc).TotalMinutes : 0) - ws.Breaks.Sum(b => b.DurationMinutes))
                    .FirstOrDefault(),
                !string.IsNullOrWhiteSpace(x.MismatchReason)))
            .ToListAsync();

        return Ok(new PagedReportResponse<TimesheetSummaryReportRow>(scope.Page, scope.PageSize, total, rows));
    }

    [HttpGet("project-effort")]
    public async Task<IActionResult> ProjectEffort([FromQuery] ReportFilterRequest filter)
    {
        var scope = await BuildScopeAsync(filter);
        if (scope is null) return Forbid();

        var query = dbContext.TimesheetEntries.AsNoTracking()
            .Where(x => scope.UserIds.Contains(x.Timesheet.UserId));
        if (scope.ProjectId is { } projectId) query = query.Where(x => x.ProjectId == projectId);
        if (scope.FromDate is { } fromDate) query = query.Where(x => x.Timesheet.WorkDate >= fromDate);
        if (scope.ToDate is { } toDate) query = query.Where(x => x.Timesheet.WorkDate <= toDate);

        var groups = query.GroupBy(x => new { x.ProjectId, x.Project.Name, x.Project.Code });
        var total = await groups.CountAsync();
        var rows = await groups.OrderByDescending(x => x.Sum(y => y.Minutes))
            .Skip((scope.Page - 1) * scope.PageSize)
            .Take(scope.PageSize)
            .Select(x => new ProjectEffortReportRow(x.Key.ProjectId, x.Key.Name, x.Key.Code, x.Sum(y => y.Minutes), x.Select(y => y.Timesheet.UserId).Distinct().Count()))
            .ToListAsync();

        return Ok(new PagedReportResponse<ProjectEffortReportRow>(scope.Page, scope.PageSize, total, rows));
    }

    [HttpGet("leave-utilization")]
    public async Task<IActionResult> LeaveAndUtilization([FromQuery] ReportFilterRequest filter)
    {
        var scope = await BuildScopeAsync(filter);
        if (scope is null) return Forbid();

        var users = await dbContext.Users.AsNoTracking().Where(u => scope.UserIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Username })
            .OrderBy(u => u.Username)
            .ToListAsync();

        var fromDate = scope.FromDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
        var toDate = scope.ToDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var pagedUsers = users.Skip((scope.Page - 1) * scope.PageSize).Take(scope.PageSize).ToList();
        var pagedUserIds = pagedUsers.Select(u => u.Id).ToList();

        // Batch: leave counts grouped by user
        var leaveCounts = await dbContext.LeaveRequests
            .Where(x => pagedUserIds.Contains(x.UserId) && x.Status == LeaveRequestStatus.Approved && x.LeaveDate >= fromDate && x.LeaveDate <= toDate)
            .GroupBy(x => new { x.UserId, x.IsHalfDay })
            .Select(g => new { g.Key.UserId, g.Key.IsHalfDay, Count = g.Count() })
            .ToListAsync();

        // Batch: timesheet minutes grouped by user
        var timesheetMinutes = await dbContext.Timesheets
            .Where(x => pagedUserIds.Contains(x.UserId) && x.WorkDate >= fromDate && x.WorkDate <= toDate)
            .GroupBy(x => x.UserId)
            .Select(g => new { UserId = g.Key, Minutes = g.Sum(t => t.Entries.Sum(e => e.Minutes)) })
            .ToListAsync();

        var potentialMinutes = Math.Max(1, ((toDate.DayNumber - fromDate.DayNumber) + 1) * 8 * 60);

        var rows = pagedUsers.Select(user =>
        {
            var fullDays = leaveCounts.FirstOrDefault(l => l.UserId == user.Id && !l.IsHalfDay)?.Count ?? 0;
            var halfDays = leaveCounts.FirstOrDefault(l => l.UserId == user.Id && l.IsHalfDay)?.Count ?? 0;
            var minutes = timesheetMinutes.FirstOrDefault(t => t.UserId == user.Id)?.Minutes ?? 0;
            return new LeaveUtilizationReportRow(user.Id, user.Username, fullDays, halfDays, minutes, Math.Round(minutes * 100m / potentialMinutes, 2));
        }).ToList();

        return Ok(new PagedReportResponse<LeaveUtilizationReportRow>(scope.Page, scope.PageSize, users.Count, rows));
    }

    [HttpGet("{reportKey}/export")]
    public async Task<IActionResult> Export(string reportKey, [FromQuery] string format = "csv", [FromQuery] ReportFilterRequest? filter = null)
    {
        format = format.ToLowerInvariant();
        var reportData = await BuildRawReport(reportKey, filter ?? new ReportFilterRequest(null, null, null, null, null));
        if (reportData is null) return NotFound(new { message = "Unknown report key." });

        var csv = ToCsv(reportData.Value.Headers, reportData.Value.Rows);
        var bytes = Encoding.UTF8.GetBytes(csv);
        return format switch
        {
            "excel" => File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{reportKey}-{DateTime.UtcNow:yyyyMMdd}.xlsx"),
            "pdf" => File(bytes, "application/pdf", $"{reportKey}-{DateTime.UtcNow:yyyyMMdd}.pdf"),
            _ => File(bytes, "text/csv", $"{reportKey}-{DateTime.UtcNow:yyyyMMdd}.csv")
        };
    }

    private async Task<(string[] Headers, List<string[]> Rows)?> BuildRawReport(string reportKey, ReportFilterRequest filter)
    {
        switch (reportKey.ToLowerInvariant())
        {
            case "attendance-summary":
            {
                var data = (await AttendanceSummary(filter) as OkObjectResult)?.Value as PagedReportResponse<AttendanceSummaryReportRow>;
                if (data is null) return null;
                return (new[] { "userId", "username", "workDate", "attendanceMinutes", "breakMinutes", "hasException" }, data.Items.Select(x => new[] { x.UserId.ToString(), x.Username, x.WorkDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), x.AttendanceMinutes.ToString(), x.BreakMinutes.ToString(), x.HasException.ToString() }).ToList());
            }
            case "timesheet-summary":
            {
                var data = (await TimesheetSummary(filter) as OkObjectResult)?.Value as PagedReportResponse<TimesheetSummaryReportRow>;
                if (data is null) return null;
                return (new[] { "userId", "username", "workDate", "status", "enteredMinutes", "attendanceMinutes", "hasMismatch" }, data.Items.Select(x => new[] { x.UserId.ToString(), x.Username, x.WorkDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), x.Status, x.EnteredMinutes.ToString(), x.AttendanceMinutes.ToString(), x.HasMismatch.ToString() }).ToList());
            }
            case "project-effort":
            {
                var data = (await ProjectEffort(filter) as OkObjectResult)?.Value as PagedReportResponse<ProjectEffortReportRow>;
                if (data is null) return null;
                return (new[] { "projectId", "projectName", "projectCode", "totalMinutes", "distinctContributors" }, data.Items.Select(x => new[] { x.ProjectId.ToString(), x.ProjectName, x.ProjectCode, x.TotalMinutes.ToString(), x.DistinctContributors.ToString() }).ToList());
            }
            case "leave-utilization":
            {
                var data = (await LeaveAndUtilization(filter) as OkObjectResult)?.Value as PagedReportResponse<LeaveUtilizationReportRow>;
                if (data is null) return null;
                return (new[] { "userId", "username", "leaveDays", "halfDays", "timesheetMinutes", "utilizationPercent" }, data.Items.Select(x => new[] { x.UserId.ToString(), x.Username, x.LeaveDays.ToString(), x.HalfDays.ToString(), x.TimesheetMinutes.ToString(), x.UtilizationPercent.ToString(CultureInfo.InvariantCulture) }).ToList());
            }
            default:
                return null;
        }
    }

    private static string ToCsv(IReadOnlyCollection<string> headers, IReadOnlyCollection<string[]> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(',', headers));
        foreach (var row in rows)
        {
            sb.AppendLine(string.Join(',', row.Select(EscapeCsv)));
        }

        return sb.ToString();
    }

    private static string EscapeCsv(string value)
    {
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }

    private async Task<ReportScope?> BuildScopeAsync(ReportFilterRequest filter)
    {
        var userId = GetUserId();
        if (userId is null) return null;

        var role = User.FindFirstValue(ClaimTypes.Role) ?? "employee";
        var fromDate = filter.FromDate;
        var toDate = filter.ToDate;
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 200);

        IQueryable<User> users = dbContext.Users.AsNoTracking().Where(u => u.IsActive);
        if (filter.DepartmentId is { } departmentId)
        {
            users = users.Where(u => u.DepartmentId == departmentId);
        }

        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            if (filter.UserId is { } explicitUserId) users = users.Where(u => u.Id == explicitUserId);
            return new ReportScope(await users.Select(u => u.Id).ToListAsync(), fromDate, toDate, page, pageSize, filter.ProjectId);
        }

        if (string.Equals(role, "manager", StringComparison.OrdinalIgnoreCase))
        {
            var myTeam = await dbContext.Users.AsNoTracking().Where(u => u.ManagerId == userId || u.Id == userId).Select(u => u.Id).ToListAsync();
            users = users.Where(u => myTeam.Contains(u.Id));
            if (filter.UserId is { } explicitUserId) users = users.Where(u => u.Id == explicitUserId);
            return new ReportScope(await users.Select(u => u.Id).ToListAsync(), fromDate, toDate, page, pageSize, filter.ProjectId);
        }

        users = users.Where(u => u.Id == userId);
        return new ReportScope(await users.Select(u => u.Id).ToListAsync(), fromDate, toDate, page, pageSize, filter.ProjectId);
    }

    private Guid? GetUserId()
    {
        var rawUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(rawUserId, out var userId) ? userId : null;
    }

    private sealed record ReportScope(List<Guid> UserIds, DateOnly? FromDate, DateOnly? ToDate, int Page, int PageSize, Guid? ProjectId);
}

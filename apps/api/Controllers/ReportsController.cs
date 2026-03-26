using System.Globalization;
using System.Security.Claims;
using System.Text;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;

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

    [HttpGet("leave-balance")]
    public async Task<IActionResult> LeaveBalance([FromQuery] ReportFilterRequest filter)
    {
        var scope = await BuildScopeAsync(filter);
        if (scope is null) return Forbid();

        var year = scope.FromDate?.Year ?? DateTime.UtcNow.Year;
        var yearStart = new DateOnly(year, 1, 1);
        var yearEnd = new DateOnly(year, 12, 31);

        var users = await dbContext.Users.AsNoTracking()
            .Where(u => scope.UserIds.Contains(u.Id) && u.LeavePolicyId != null)
            .Select(u => new { u.Id, u.Username, u.LeavePolicyId })
            .OrderBy(u => u.Username)
            .ToListAsync();

        var policyIds = users.Select(u => u.LeavePolicyId!.Value).Distinct().ToList();
        var allocations = await dbContext.LeavePolicyAllocations.AsNoTracking()
            .Where(a => policyIds.Contains(a.LeavePolicyId))
            .Select(a => new { a.LeavePolicyId, a.LeaveTypeId, LeaveTypeName = a.LeaveType.Name, a.DaysPerYear })
            .ToListAsync();

        var userIds = users.Select(u => u.Id).ToList();
        var usedLeave = await dbContext.LeaveRequests.AsNoTracking()
            .Where(lr => userIds.Contains(lr.UserId) &&
                         lr.Status == LeaveRequestStatus.Approved &&
                         lr.LeaveDate >= yearStart && lr.LeaveDate <= yearEnd)
            .GroupBy(lr => new { lr.UserId, lr.LeaveTypeId })
            .Select(g => new { g.Key.UserId, g.Key.LeaveTypeId, Count = g.Count() })
            .ToListAsync();

        var rows = new List<LeaveBalanceReportRow>();
        foreach (var user in users)
        {
            foreach (var alloc in allocations.Where(a => a.LeavePolicyId == user.LeavePolicyId!.Value))
            {
                var used = usedLeave.FirstOrDefault(l => l.UserId == user.Id && l.LeaveTypeId == alloc.LeaveTypeId)?.Count ?? 0;
                rows.Add(new LeaveBalanceReportRow(user.Id, user.Username, alloc.LeaveTypeName, alloc.DaysPerYear, used, alloc.DaysPerYear - used));
            }
        }

        var total = rows.Count;
        var paged = rows.OrderBy(r => r.Username).ThenBy(r => r.LeaveTypeName)
            .Skip((scope.Page - 1) * scope.PageSize).Take(scope.PageSize).ToList();
        return Ok(new PagedReportResponse<LeaveBalanceReportRow>(scope.Page, scope.PageSize, total, paged));
    }

    [HttpGet("timesheet-approval-status")]
    public async Task<IActionResult> TimesheetApprovalStatus([FromQuery] ReportFilterRequest filter)
    {
        var scope = await BuildScopeAsync(filter);
        if (scope is null) return Forbid();

        var query = dbContext.Timesheets.AsNoTracking().Where(x => scope.UserIds.Contains(x.UserId));
        if (scope.FromDate is { } fromDate) query = query.Where(x => x.WorkDate >= fromDate);
        if (scope.ToDate is { } toDate) query = query.Where(x => x.WorkDate <= toDate);

        var total = await query.CountAsync();

        var approverIds = await query.Where(x => x.ApprovedByUserId != null)
            .Select(x => x.ApprovedByUserId!.Value).Distinct().ToListAsync();
        var approvers = await dbContext.Users.AsNoTracking()
            .Where(u => approverIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Username })
            .ToListAsync();

        var rawRows = await query
            .OrderByDescending(x => x.WorkDate)
            .Skip((scope.Page - 1) * scope.PageSize)
            .Take(scope.PageSize)
            .Select(x => new
            {
                x.UserId,
                Username = x.User.Username,
                x.WorkDate,
                EnteredMinutes = x.Entries.Sum(e => e.Minutes),
                Status = x.Status.ToString(),
                x.ApprovedByUserId,
                x.ApprovedAtUtc
            })
            .ToListAsync();

        var rows = rawRows.Select(x => new TimesheetApprovalStatusReportRow(
            x.UserId, x.Username, x.WorkDate, x.EnteredMinutes, x.Status,
            x.ApprovedByUserId != null ? approvers.FirstOrDefault(a => a.Id == x.ApprovedByUserId.Value)?.Username : null,
            x.ApprovedAtUtc)).ToList();

        return Ok(new PagedReportResponse<TimesheetApprovalStatusReportRow>(scope.Page, scope.PageSize, total, rows));
    }

    [HttpGet("overtime-deficit")]
    public async Task<IActionResult> OvertimeDeficit([FromQuery] ReportFilterRequest filter)
    {
        var scope = await BuildScopeAsync(filter);
        if (scope is null) return Forbid();

        var fromDate = scope.FromDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-28));
        var toDate = scope.ToDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var userInfos = await dbContext.Users.AsNoTracking()
            .Where(u => scope.UserIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Username, u.WorkPolicyId })
            .ToListAsync();

        var policyIds = userInfos.Where(u => u.WorkPolicyId != null).Select(u => u.WorkPolicyId!.Value).Distinct().ToList();
        var policies = await dbContext.WorkPolicies.AsNoTracking()
            .Where(wp => policyIds.Contains(wp.Id))
            .Select(wp => new { wp.Id, wp.DailyExpectedMinutes })
            .ToListAsync();

        var expectedPerUser = userInfos.ToDictionary(
            u => u.Id,
            u => u.WorkPolicyId != null ? (policies.FirstOrDefault(p => p.Id == u.WorkPolicyId.Value)?.DailyExpectedMinutes ?? 480) : 480);

        var timesheets = await dbContext.Timesheets.AsNoTracking()
            .Where(x => scope.UserIds.Contains(x.UserId) && x.WorkDate >= fromDate && x.WorkDate <= toDate)
            .Select(x => new { x.UserId, x.WorkDate, LoggedMinutes = x.Entries.Sum(e => e.Minutes) })
            .ToListAsync();

        static DateOnly GetWeekStart(DateOnly date)
        {
            int dow = (int)date.DayOfWeek;
            return date.AddDays(dow == 0 ? -6 : -(dow - 1));
        }

        var rows = timesheets
            .GroupBy(t => new { t.UserId, WeekStart = GetWeekStart(t.WorkDate) })
            .Select(g =>
            {
                var info = userInfos.First(u => u.Id == g.Key.UserId);
                var logged = g.Sum(t => t.LoggedMinutes);
                var workDays = g.Count(t => t.WorkDate.DayOfWeek != DayOfWeek.Sunday);
                var target = workDays * expectedPerUser[g.Key.UserId];
                return new OvertimeDeficitReportRow(g.Key.UserId, info.Username, g.Key.WeekStart, target, logged, logged - target);
            })
            .OrderByDescending(r => r.WeekStart)
            .ThenBy(r => r.Username)
            .ToList();

        var total = rows.Count;
        var paged = rows.Skip((scope.Page - 1) * scope.PageSize).Take(scope.PageSize).ToList();
        return Ok(new PagedReportResponse<OvertimeDeficitReportRow>(scope.Page, scope.PageSize, total, paged));
    }

    [HttpGet("{reportKey}/export")]
    public async Task<IActionResult> Export(string reportKey, [FromQuery] string format = "csv", [FromQuery] ReportFilterRequest? filter = null)
    {
        var reportData = await BuildRawReport(reportKey, filter ?? new ReportFilterRequest(null, null, null, null, null));
        if (reportData is null) return NotFound(new { message = "Unknown report key." });

        var (headers, rows) = reportData.Value;
        var fileName = $"{reportKey}-{DateTime.UtcNow:yyyyMMdd}";

        return format.ToLowerInvariant() switch
        {
            "excel" or "xlsx" => BuildExcel(headers, rows, fileName),
            "pdf" => BuildPdf(headers, rows, fileName, reportKey),
            _ => BuildCsv(headers, rows, fileName)
        };
    }

    private IActionResult BuildCsv(string[] headers, List<string[]> rows, string fileName)
    {
        var csv = ToCsv(headers, rows);
        var bytes = Encoding.UTF8.GetBytes(csv);
        return File(bytes, "text/csv", $"{fileName}.csv");
    }

    private IActionResult BuildExcel(string[] headers, List<string[]> rows, string fileName)
    {
        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Report");

        // Header row — bold, light blue fill
        for (var col = 0; col < headers.Length; col++)
        {
            var cell = ws.Cell(1, col + 1);
            cell.Value = headers[col];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#4F81BD");
            cell.Style.Font.FontColor = XLColor.White;
        }

        // Data rows
        for (var row = 0; row < rows.Count; row++)
        {
            for (var col = 0; col < rows[row].Length; col++)
            {
                ws.Cell(row + 2, col + 1).Value = rows[row][col];
            }
            // Alternate row shading
            if (row % 2 == 0)
                ws.Row(row + 2).Cells(1, headers.Length).Style.Fill.BackgroundColor = XLColor.FromHtml("#F2F7FF");
        }

        ws.Columns().AdjustToContents();
        ws.SheetView.FreezeRows(1);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{fileName}.xlsx");
    }

    private IActionResult BuildPdf(string[] headers, List<string[]> rows, string fileName, string reportTitle)
    {
        // Use QuestPDF to generate a real PDF
        QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

        var pdfBytes = QuestPDF.Fluent.Document.Create(container =>
        {
            container.Page(page => BuildPdfPage(page, headers, rows, reportTitle));
        }).GeneratePdf();

        return File(pdfBytes, "application/pdf", $"{fileName}.pdf");
    }

    private static void BuildPdfPage(QuestPDF.Fluent.PageDescriptor page, string[] headers, List<string[]> rows, string reportTitle)
    {
        page.Size(PageSizes.A4.Landscape());
        page.Margin(1.5f, QuestPDF.Infrastructure.Unit.Centimetre);
        page.DefaultTextStyle(x => x.FontSize(8).FontFamily("Arial"));

        page.Header().Column(col =>
        {
            col.Item().Text(CultureInfo.CurrentCulture.TextInfo.ToTitleCase(reportTitle.Replace("-", " ")))
                .FontSize(14).Bold().FontColor(QuestPDF.Helpers.Colors.Blue.Darken2);
            col.Item().Text($"Generated: {DateTime.UtcNow:dd MMM yyyy HH:mm} UTC")
                .FontSize(8).FontColor(QuestPDF.Helpers.Colors.Grey.Medium);
            col.Item().PaddingTop(4).LineHorizontal(0.5f).LineColor(QuestPDF.Helpers.Colors.Grey.Lighten2);
        });

        page.Content().PaddingTop(8).Table(table =>
        {
            table.ColumnsDefinition(cols =>
            {
                foreach (var _ in headers)
                    cols.RelativeColumn();
            });

            table.Header(header =>
            {
                foreach (var h in headers)
                {
                    header.Cell().Background(QuestPDF.Helpers.Colors.Blue.Darken2)
                        .Padding(4).Text(h).FontColor(QuestPDF.Helpers.Colors.White).Bold().FontSize(7);
                }
            });

            for (var i = 0; i < rows.Count; i++)
            {
                var bg = i % 2 == 0 ? QuestPDF.Helpers.Colors.White : QuestPDF.Helpers.Colors.Grey.Lighten5;
                foreach (var cell in rows[i])
                {
                    table.Cell().Background(bg).Padding(3).Text(cell).FontSize(7);
                }
            }
        });

        page.Footer().AlignCenter().Text(x =>
        {
            x.Span("Page ").FontSize(7).FontColor(QuestPDF.Helpers.Colors.Grey.Medium);
            x.CurrentPageNumber().FontSize(7).FontColor(QuestPDF.Helpers.Colors.Grey.Medium);
            x.Span(" of ").FontSize(7).FontColor(QuestPDF.Helpers.Colors.Grey.Medium);
            x.TotalPages().FontSize(7).FontColor(QuestPDF.Helpers.Colors.Grey.Medium);
        });
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
            case "leave-balance":
            {
                var data = (await LeaveBalance(filter) as OkObjectResult)?.Value as PagedReportResponse<LeaveBalanceReportRow>;
                if (data is null) return null;
                return (new[] { "userId", "username", "leaveTypeName", "allocatedDays", "usedDays", "remainingDays" }, data.Items.Select(x => new[] { x.UserId.ToString(), x.Username, x.LeaveTypeName, x.AllocatedDays.ToString(), x.UsedDays.ToString(), x.RemainingDays.ToString() }).ToList());
            }
            case "timesheet-approval-status":
            {
                var data = (await TimesheetApprovalStatus(filter) as OkObjectResult)?.Value as PagedReportResponse<TimesheetApprovalStatusReportRow>;
                if (data is null) return null;
                return (new[] { "userId", "username", "workDate", "enteredMinutes", "status", "approvedByUsername", "approvedAtUtc" }, data.Items.Select(x => new[] { x.UserId.ToString(), x.Username, x.WorkDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), x.EnteredMinutes.ToString(), x.Status, x.ApprovedByUsername ?? "", x.ApprovedAtUtc?.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) ?? "" }).ToList());
            }
            case "overtime-deficit":
            {
                var data = (await OvertimeDeficit(filter) as OkObjectResult)?.Value as PagedReportResponse<OvertimeDeficitReportRow>;
                if (data is null) return null;
                return (new[] { "userId", "username", "weekStart", "targetMinutes", "loggedMinutes", "deltaMinutes" }, data.Items.Select(x => new[] { x.UserId.ToString(), x.Username, x.WeekStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), x.TargetMinutes.ToString(), x.LoggedMinutes.ToString(), x.DeltaMinutes.ToString() }).ToList());
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

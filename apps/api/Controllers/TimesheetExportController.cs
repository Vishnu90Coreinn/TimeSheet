using System.Globalization;
using System.Security.Claims;
using System.Text;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/timesheets/export")]
public class TimesheetExportController(TimeSheetDbContext dbContext) : ControllerBase
{
    private static readonly string[] CsvHeaders =
        ["Date", "Employee", "Status", "Project", "Task Category", "Minutes", "Hours", "Notes"];

    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<TimesheetExportUserDto>>> GetExportableUsers(
        CancellationToken ct)
    {
        var callerId = GetCallerId();
        if (callerId is null) return Unauthorized();

        var role = User.FindFirstValue(ClaimTypes.Role) ?? "employee";

        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            var all = await dbContext.Users.AsNoTracking()
                .Where(u => u.IsActive)
                .OrderBy(u => u.DisplayName)
                .Select(u => new TimesheetExportUserDto(u.Id, u.DisplayName, u.Username))
                .ToListAsync(ct);
            return Ok(all);
        }

        if (string.Equals(role, "manager", StringComparison.OrdinalIgnoreCase))
        {
            var team = await dbContext.Users.AsNoTracking()
                .Where(u => u.IsActive && (u.ManagerId == callerId || u.Id == callerId))
                .OrderBy(u => u.DisplayName)
                .Select(u => new TimesheetExportUserDto(u.Id, u.DisplayName, u.Username))
                .ToListAsync(ct);
            return Ok(team);
        }

        var self = await dbContext.Users.AsNoTracking()
            .Where(u => u.Id == callerId)
            .Select(u => new TimesheetExportUserDto(u.Id, u.DisplayName, u.Username))
            .FirstOrDefaultAsync(ct);

        return self is null ? NotFound() : Ok(new List<TimesheetExportUserDto> { self });
    }

    [HttpGet]
    public async Task<IActionResult> Export(
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] Guid? userId,
        [FromQuery] string format = "csv",
        CancellationToken ct = default)
    {
        if (fromDate is null || toDate is null)
            return BadRequest(new { message = "fromDate and toDate are required." });

        if (toDate < fromDate)
            return BadRequest(new { message = "toDate must be on or after fromDate." });

        if (toDate.Value.DayNumber - fromDate.Value.DayNumber > 366)
            return BadRequest(new { message = "Date range cannot exceed 366 days." });

        var callerId = GetCallerId();
        if (callerId is null) return Unauthorized();

        var permittedIds = await BuildPermittedIdsAsync(callerId.Value, ct);

        List<Guid> targetIds;
        if (userId.HasValue)
        {
            if (!permittedIds.Contains(userId.Value))
                return StatusCode(403, new { message = "You are not permitted to export data for that user." });

            targetIds = [userId.Value];
        }
        else
        {
            targetIds = permittedIds;
        }

        var rows = await FetchExportRowsAsync(targetIds, fromDate.Value, toDate.Value, ct);
        var fileName = $"timesheets-{fromDate.Value:yyyy-MM-dd}-to-{toDate.Value:yyyy-MM-dd}";

        return format.ToLowerInvariant() switch
        {
            "excel" or "xlsx" => BuildExcel(rows, fileName),
            "pdf" => BuildPdf(rows, fileName),
            _ => BuildCsv(rows, fileName)
        };
    }

    private async Task<List<Guid>> BuildPermittedIdsAsync(Guid callerId, CancellationToken ct)
    {
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "employee";

        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
            return await dbContext.Users.AsNoTracking()
                .Where(u => u.IsActive)
                .Select(u => u.Id)
                .ToListAsync(ct);

        if (string.Equals(role, "manager", StringComparison.OrdinalIgnoreCase))
            return await dbContext.Users.AsNoTracking()
                .Where(u => u.IsActive && (u.ManagerId == callerId || u.Id == callerId))
                .Select(u => u.Id)
                .ToListAsync(ct);

        return [callerId];
    }

    private sealed record ExportRow(
        DateOnly Date,
        string Employee,
        string Status,
        string Project,
        string TaskCategory,
        int Minutes,
        string Notes);

    private async Task<List<ExportRow>> FetchExportRowsAsync(
        List<Guid> userIds,
        DateOnly from,
        DateOnly to,
        CancellationToken ct)
    {
        var raw = await dbContext.Timesheets.AsNoTracking()
            .Where(t => userIds.Contains(t.UserId)
                        && t.WorkDate >= from
                        && t.WorkDate <= to
                        && t.Entries.Any())
            .OrderBy(t => t.WorkDate)
            .ThenBy(t => t.UserId)
            .Select(t => new
            {
                t.UserId,
                t.WorkDate,
                Status = t.Status.ToString(),
                Entries = t.Entries.Select(e => new
                {
                    ProjectName = e.Project.Name,
                    TaskCategoryName = e.TaskCategory.Name,
                    e.Minutes,
                    e.Notes
                })
            })
            .ToListAsync(ct);

        var userNames = await dbContext.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new
            {
                u.Id,
                Name = string.IsNullOrWhiteSpace(u.DisplayName) ? u.Username : u.DisplayName
            })
            .ToDictionaryAsync(u => u.Id, u => u.Name, ct);

        var rows = new List<ExportRow>();

        foreach (var t in raw)
        {
            var employee = userNames.TryGetValue(t.UserId, out var displayName) ? displayName : "Unknown";
            foreach (var e in t.Entries)
            {
                rows.Add(new ExportRow(
                    t.WorkDate,
                    employee,
                    t.Status,
                    e.ProjectName,
                    e.TaskCategoryName,
                    e.Minutes,
                    e.Notes ?? string.Empty));
            }
        }

        return rows;
    }

    private static string[] ToStringArray(ExportRow r) =>
    [
        r.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        r.Employee,
        r.Status,
        r.Project,
        r.TaskCategory,
        r.Minutes.ToString(CultureInfo.InvariantCulture),
        (r.Minutes / 60.0).ToString("F2", CultureInfo.InvariantCulture),
        r.Notes
    ];

    private IActionResult BuildCsv(List<ExportRow> rows, string fileName)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(',', CsvHeaders));

        foreach (var r in rows)
        {
            sb.AppendLine(string.Join(',', ToStringArray(r).Select(CsvQuote)));
        }

        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"{fileName}.csv");
    }

    private static string CsvQuote(string value) =>
        value.Contains(',') || value.Contains('"') || value.Contains('\n')
            ? $"\"{value.Replace("\"", "\"\"")}\""
            : value;

    private IActionResult BuildExcel(List<ExportRow> rows, string fileName)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Timesheets");

        for (var col = 0; col < CsvHeaders.Length; col++)
        {
            var cell = ws.Cell(1, col + 1);
            cell.Value = CsvHeaders[col];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#4F81BD");
            cell.Style.Font.FontColor = XLColor.White;
        }

        for (var i = 0; i < rows.Count; i++)
        {
            var cols = ToStringArray(rows[i]);
            for (var c = 0; c < cols.Length; c++)
                ws.Cell(i + 2, c + 1).Value = cols[c];

            if (i % 2 == 0)
                ws.Row(i + 2).Cells(1, CsvHeaders.Length)
                    .Style.Fill.BackgroundColor = XLColor.FromHtml("#F2F7FF");
        }

        ws.Columns().AdjustToContents();
        ws.SheetView.FreezeRows(1);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return File(ms.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"{fileName}.xlsx");
    }

    private IActionResult BuildPdf(List<ExportRow> rows, string fileName)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var pdfBytes = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(1.5f, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(8).FontFamily("Arial"));

                page.Header().Column(col =>
                {
                    col.Item().Text("Timesheet Export")
                        .FontSize(14).Bold().FontColor(Colors.Blue.Darken2);
                    col.Item().Text($"Generated: {DateTime.UtcNow:dd MMM yyyy HH:mm} UTC")
                        .FontSize(8).FontColor(Colors.Grey.Medium);
                    col.Item().PaddingTop(4).LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten2);
                });

                page.Content().PaddingTop(8).Table(table =>
                {
                    table.ColumnsDefinition(cols =>
                    {
                        foreach (var _ in CsvHeaders) cols.RelativeColumn();
                    });

                    table.Header(header =>
                    {
                        foreach (var h in CsvHeaders)
                        {
                            header.Cell().Background(Colors.Blue.Darken2)
                                .Padding(4).Text(h)
                                .FontColor(Colors.White).Bold().FontSize(7);
                        }
                    });

                    for (var i = 0; i < rows.Count; i++)
                    {
                        var bg = i % 2 == 0 ? Colors.White : Colors.Grey.Lighten5;
                        foreach (var cell in ToStringArray(rows[i]))
                            table.Cell().Background(bg).Padding(3).Text(cell).FontSize(7);
                    }
                });

                page.Footer().AlignCenter().Text(x =>
                {
                    x.Span("Page ").FontSize(7).FontColor(Colors.Grey.Medium);
                    x.CurrentPageNumber().FontSize(7).FontColor(Colors.Grey.Medium);
                    x.Span(" of ").FontSize(7).FontColor(Colors.Grey.Medium);
                    x.TotalPages().FontSize(7).FontColor(Colors.Grey.Medium);
                });
            });
        }).GeneratePdf();

        return File(pdfBytes, "application/pdf", $"{fileName}.pdf");
    }

    private Guid? GetCallerId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}

using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.TimesheetExports.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/timesheets/export")]
public class TimesheetExportController(ISender mediator) : ControllerBase
{
    private static readonly string[] CsvHeaders =
        ["Date", "Employee", "Status", "Project", "Task Category", "Minutes", "Hours", "Notes"];

    [HttpGet("users")]
    public async Task<IActionResult> GetExportableUsers(CancellationToken ct)
    {
        var result = await mediator.Send(new GetTimesheetExportableUsersQuery(), ct);
        if (!result.IsSuccess) return Fail(result);
        return Ok(result.Value!.Select(x => new TimesheetExportUserDto(x.Id, x.DisplayName, x.Username)).ToList());
    }

    [HttpGet]
    public async Task<IActionResult> Export(
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] Guid? userId,
        [FromQuery] List<Guid>? userIds,
        [FromQuery] string format = "csv",
        CancellationToken ct = default)
    {
        if (fromDate is null || toDate is null)
            return BadRequest(new { message = "fromDate and toDate are required." });
        if (toDate < fromDate)
            return BadRequest(new { message = "toDate must be on or after fromDate." });
        if (toDate.Value.DayNumber - fromDate.Value.DayNumber > 366)
            return BadRequest(new { message = "Date range cannot exceed 366 days." });

        var result = await mediator.Send(new BuildTimesheetExportQuery(fromDate.Value, toDate.Value, userId, userIds), ct);
        if (!result.IsSuccess) return Fail(result);

        var rows = result.Value!.Rows.ToList();
        return format.ToLowerInvariant() switch
        {
            "excel" or "xlsx" => BuildExcel(rows, result.Value.FileName),
            "pdf" => BuildPdf(rows, result.Value.FileName),
            _ => BuildCsv(rows, result.Value.FileName)
        };
    }

    private static string[] ToStringArray(TimesheetExportRowResult r) =>
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

    private IActionResult BuildCsv(List<TimesheetExportRowResult> rows, string fileName)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(',', CsvHeaders));
        foreach (var r in rows)
            sb.AppendLine(string.Join(',', ToStringArray(r).Select(CsvQuote)));
        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"{fileName}.csv");
    }

    private static string CsvQuote(string value) =>
        value.Contains(',') || value.Contains('"') || value.Contains('\n')
            ? $"\"{value.Replace("\"", "\"\"")}\""
            : value;

    private IActionResult BuildExcel(List<TimesheetExportRowResult> rows, string fileName)
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
            for (var c = 0; c < cols.Length; c++) ws.Cell(i + 2, c + 1).Value = cols[c];
            if (i % 2 == 0) ws.Row(i + 2).Cells(1, CsvHeaders.Length).Style.Fill.BackgroundColor = XLColor.FromHtml("#F2F7FF");
        }
        ws.Columns().AdjustToContents();
        ws.SheetView.FreezeRows(1);
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{fileName}.xlsx");
    }

    private IActionResult BuildPdf(List<TimesheetExportRowResult> rows, string fileName)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var pdfBytes = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(1.5f, QuestPDF.Infrastructure.Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(8).FontFamily("Arial"));
                page.Header().Column(col =>
                {
                    col.Item().Text("Timesheet Export").FontSize(14).Bold().FontColor(Colors.Blue.Darken2);
                    col.Item().Text($"Generated: {DateTime.UtcNow:dd MMM yyyy HH:mm} UTC").FontSize(8).FontColor(Colors.Grey.Medium);
                    col.Item().PaddingTop(4).LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten2);
                });
                page.Content().PaddingTop(8).Table(table =>
                {
                    table.ColumnsDefinition(cols => { foreach (var _ in CsvHeaders) cols.RelativeColumn(); });
                    table.Header(header =>
                    {
                        foreach (var h in CsvHeaders)
                            header.Cell().Background(Colors.Blue.Darken2).Padding(4).Text(h).FontColor(Colors.White).Bold().FontSize(7);
                    });
                    for (var i = 0; i < rows.Count; i++)
                    {
                        var bg = i % 2 == 0 ? Colors.White : Colors.Grey.Lighten5;
                        foreach (var cell in ToStringArray(rows[i])) table.Cell().Background(bg).Padding(3).Text(cell).FontSize(7);
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

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => StatusCode(403, new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

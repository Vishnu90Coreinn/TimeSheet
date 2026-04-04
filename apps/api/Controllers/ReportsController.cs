using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Reports.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/reports")]
public class ReportsController(ISender mediator) : ControllerBase
{
    [HttpGet("attendance-summary")]
    public async Task<IActionResult> AttendanceSummary([FromQuery] ReportFilterRequest filter, CancellationToken ct)
    {
        var result = await mediator.Send(new GetAttendanceSummaryReportQuery(ToModel(filter)), ct);
        return result.IsSuccess
            ? Ok(ToResponse(result.Value!, x => new AttendanceSummaryReportRow(x.UserId, x.Username, x.WorkDate, x.AttendanceMinutes, x.BreakMinutes, x.HasException)))
            : Fail(result);
    }

    [HttpGet("timesheet-summary")]
    public async Task<IActionResult> TimesheetSummary([FromQuery] ReportFilterRequest filter, CancellationToken ct)
    {
        var result = await mediator.Send(new GetTimesheetSummaryReportQuery(ToModel(filter)), ct);
        return result.IsSuccess
            ? Ok(ToResponse(result.Value!, x => new TimesheetSummaryReportRow(x.UserId, x.Username, x.WorkDate, x.Status, x.EnteredMinutes, x.AttendanceMinutes, x.HasMismatch)))
            : Fail(result);
    }

    [HttpGet("project-effort")]
    public async Task<IActionResult> ProjectEffort([FromQuery] ReportFilterRequest filter, CancellationToken ct)
    {
        var result = await mediator.Send(new GetProjectEffortReportQuery(ToModel(filter)), ct);
        return result.IsSuccess
            ? Ok(ToResponse(result.Value!, x => new ProjectEffortReportRow(x.ProjectId, x.ProjectName, x.ProjectCode, x.TotalMinutes, x.DistinctContributors)))
            : Fail(result);
    }

    [HttpGet("leave-utilization")]
    public async Task<IActionResult> LeaveAndUtilization([FromQuery] ReportFilterRequest filter, CancellationToken ct)
    {
        var result = await mediator.Send(new GetLeaveUtilizationReportQuery(ToModel(filter)), ct);
        return result.IsSuccess
            ? Ok(ToResponse(result.Value!, x => new LeaveUtilizationReportRow(x.UserId, x.Username, x.LeaveDays, x.HalfDays, x.TimesheetMinutes, x.UtilizationPercent)))
            : Fail(result);
    }

    [HttpGet("leave-balance")]
    public async Task<IActionResult> LeaveBalance([FromQuery] ReportFilterRequest filter, CancellationToken ct)
    {
        var result = await mediator.Send(new GetLeaveBalanceReportQuery(ToModel(filter)), ct);
        return result.IsSuccess
            ? Ok(ToResponse(result.Value!, x => new LeaveBalanceReportRow(x.UserId, x.Username, x.LeaveTypeName, x.AllocatedDays, x.UsedDays, x.RemainingDays)))
            : Fail(result);
    }

    [HttpGet("timesheet-approval-status")]
    public async Task<IActionResult> TimesheetApprovalStatus([FromQuery] ReportFilterRequest filter, CancellationToken ct)
    {
        var result = await mediator.Send(new GetTimesheetApprovalStatusReportQuery(ToModel(filter)), ct);
        return result.IsSuccess
            ? Ok(ToResponse(result.Value!, x => new TimesheetApprovalStatusReportRow(x.UserId, x.Username, x.WorkDate, x.EnteredMinutes, x.Status, x.ApprovedByUsername, x.ApprovedAtUtc)))
            : Fail(result);
    }

    [HttpGet("overtime-deficit")]
    public async Task<IActionResult> OvertimeDeficit([FromQuery] ReportFilterRequest filter, CancellationToken ct)
    {
        var result = await mediator.Send(new GetOvertimeDeficitReportQuery(ToModel(filter)), ct);
        return result.IsSuccess
            ? Ok(ToResponse(result.Value!, x => new OvertimeDeficitReportRow(x.UserId, x.Username, x.WeekStart, x.TargetMinutes, x.LoggedMinutes, x.DeltaMinutes)))
            : Fail(result);
    }

    [HttpGet("{reportKey}/export")]
    public async Task<IActionResult> Export(string reportKey, [FromQuery] string format = "csv", [FromQuery] ReportFilterRequest? filter = null, CancellationToken ct = default)
    {
        var result = await mediator.Send(new ExportReportQuery(reportKey, ToModel(filter ?? new ReportFilterRequest(null, null, null, null, null))), ct);
        if (!result.IsSuccess)
            return Fail(result);

        var reportData = result.Value!;
        var headers = reportData.Headers;
        var rows = reportData.Rows;
        var fileName = reportData.FileName;

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

    private static ReportFilterModel ToModel(ReportFilterRequest filter)
        => new(filter.FromDate, filter.ToDate, filter.UserId, filter.DepartmentId, filter.ProjectId, Math.Max(1, filter.Page), Math.Clamp(filter.PageSize, 1, 200));

    private static PagedReportResponse<TResponse> ToResponse<TModel, TResponse>(PagedResult<TModel> page, Func<TModel, TResponse> map)
        => new(page.Page, page.PageSize, page.TotalCount, page.Items.Select(map).ToList());

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Forbid(),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

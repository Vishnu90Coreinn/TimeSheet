# Timesheet Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow all users to export their timesheet entries (filtered by date range and user) as CSV, Excel, or PDF, with role-based scoping: employees export only their own data, managers export their direct reports, admins export any user.

**Architecture:** A new `TimesheetExportController` (following `ReportsController` patterns) handles two endpoints — one to fetch the list of users the caller can export for (role-scoped), and one to stream the file download. The frontend adds an `ExportTimesheetModal` component wired to the existing stub Export button in `Timesheets.tsx`.

**Tech Stack:** .NET 10 / C#, ASP.NET Core, EF Core 9 (InMemory for tests), ClosedXML (Excel), QuestPDF (PDF), xUnit integration tests; React 18, TypeScript, `apiFetch` blob download, `AppSelect`/`AppInput`/`AppButton` UI primitives.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/api/Controllers/TimesheetExportController.cs` | Two export endpoints + role scoping |
| Modify | `apps/api/Dtos/TimesheetDtos.cs` | Add `TimesheetExportUserDto` record |
| Create | `apps/api.tests/TimesheetExportIntegrationTests.cs` | Integration tests for both endpoints |
| Create | `apps/web/src/components/TimesheetExportModal.tsx` | Export modal component |
| Modify | `apps/web/src/components/Timesheets.tsx` | Wire Export button → open modal |

---

## Task 1: Add `TimesheetExportUserDto` to TimesheetDtos.cs

**Files:**
- Modify: `apps/api/Dtos/TimesheetDtos.cs`

- [ ] **Step 1: Open `apps/api/Dtos/TimesheetDtos.cs` and append the new DTO at the end of the file**

```csharp
// Append after existing records:
public record TimesheetExportUserDto(Guid Id, string DisplayName, string Username);
```

- [ ] **Step 2: Build to verify no compile errors**

```bash
dotnet build apps/api/TimeSheet.Api.csproj --no-restore -q
```
Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add apps/api/Dtos/TimesheetDtos.cs
git commit -m "feat(api): add TimesheetExportUserDto"
```

---

## Task 2: Write failing integration tests for export endpoints

**Files:**
- Create: `apps/api.tests/TimesheetExportIntegrationTests.cs`

- [ ] **Step 1: Create the test file**

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TimeSheet.Api.Dtos;
using Xunit;

namespace TimeSheet.Api.Tests;

public class TimesheetExportIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public TimesheetExportIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<string> GetTokenAsync(string username, string password)
    {
        using var client = _factory.CreateClient();
        var r = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(username, password));
        var payload = await r.Content.ReadFromJsonAsync<LoginResponse>();
        return payload!.AccessToken;
    }

    // ── /timesheets/export/users ─────────────────────────────────────────────

    [Fact]
    public async Task ExportUsers_Unauthenticated_Returns401()
    {
        using var client = _factory.CreateClient();
        var r = await client.GetAsync("/api/v1/timesheets/export/users");
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
    }

    [Fact]
    public async Task ExportUsers_AsAdmin_ReturnsOkWithUsers()
    {
        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.GetAsync("/api/v1/timesheets/export/users");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var users = await r.Content.ReadFromJsonAsync<List<TimesheetExportUserDto>>();
        Assert.NotNull(users);
        Assert.NotEmpty(users);
    }

    [Fact]
    public async Task ExportUsers_AsEmployee_ReturnsSingleSelf()
    {
        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("employee1", "employee123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.GetAsync("/api/v1/timesheets/export/users");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var users = await r.Content.ReadFromJsonAsync<List<TimesheetExportUserDto>>();
        Assert.NotNull(users);
        Assert.Single(users);
    }

    // ── /timesheets/export ───────────────────────────────────────────────────

    [Fact]
    public async Task Export_Unauthenticated_Returns401()
    {
        using var client = _factory.CreateClient();
        var r = await client.GetAsync("/api/v1/timesheets/export?fromDate=2025-01-01&toDate=2025-01-31");
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
    }

    [Fact]
    public async Task Export_MissingDateRange_Returns400()
    {
        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.GetAsync("/api/v1/timesheets/export");
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    [Fact]
    public async Task Export_AsAdmin_Csv_ReturnsCsvFile()
    {
        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.GetAsync("/api/v1/timesheets/export?fromDate=2025-01-01&toDate=2025-01-31&format=csv");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("text/csv", r.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Export_AsAdmin_Excel_ReturnsExcelFile()
    {
        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.GetAsync("/api/v1/timesheets/export?fromDate=2025-01-01&toDate=2025-01-31&format=excel");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            r.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Export_AsAdmin_Pdf_ReturnsPdfFile()
    {
        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.GetAsync("/api/v1/timesheets/export?fromDate=2025-01-01&toDate=2025-01-31&format=pdf");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("application/pdf", r.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Export_AsEmployee_WithAnotherUserId_Returns403()
    {
        // This test requires a second user ID — seed one in factory or use a known admin ID
        // Employee should not be able to specify another userId
        using var client = _factory.CreateClient();
        var adminToken = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var users = await (await client.GetAsync("/api/v1/timesheets/export/users")).Content.ReadFromJsonAsync<List<TimesheetExportUserDto>>();
        var adminId = users!.First().Id;

        // Now try as employee with the admin's ID
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            await GetTokenAsync("employee1", "employee123"));
        var r = await client.GetAsync($"/api/v1/timesheets/export?fromDate=2025-01-01&toDate=2025-01-31&userId={adminId}");
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
    }

    [Fact]
    public async Task Export_DateRange_TooLarge_Returns400()
    {
        using var client = _factory.CreateClient();
        var token = await GetTokenAsync("admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // > 366 days
        var r = await client.GetAsync("/api/v1/timesheets/export?fromDate=2023-01-01&toDate=2025-01-01");
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }
}
```

- [ ] **Step 2: Run tests to confirm they all FAIL (endpoint does not exist yet)**

```bash
dotnet test apps/api.tests/TimeSheet.Api.Tests.csproj --filter "TimesheetExportIntegrationTests" -v minimal 2>&1 | tail -20
```
Expected: multiple failures with `404 Not Found` or `500` — confirms tests are wired correctly and endpoints are missing.

- [ ] **Step 3: Commit the failing tests**

```bash
git add apps/api.tests/TimesheetExportIntegrationTests.cs
git commit -m "test(api): add failing integration tests for timesheet export endpoints"
```

---

## Task 3: Create `TimesheetExportController` with `GET /timesheets/export/users`

**Files:**
- Create: `apps/api/Controllers/TimesheetExportController.cs`

- [ ] **Step 1: Create the controller file with only the `users` endpoint**

```csharp
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
using TimeSheet.Infrastructure.Persistence;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/timesheets/export")]
public class TimesheetExportController(TimeSheetDbContext dbContext) : ControllerBase
{
    private static readonly string[] CsvHeaders =
        ["Date", "Employee", "Status", "Project", "Task Category", "Minutes", "Hours", "Notes"];

    // ── GET /api/v1/timesheets/export/users ──────────────────────────────────
    // Returns the list of users the current caller is permitted to export for.
    // Admin  → all active users (ordered by DisplayName)
    // Manager → self + direct reports (u.ManagerId == callerId)
    // Employee → only themselves
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

        // Employee: only themselves
        var self = await dbContext.Users.AsNoTracking()
            .Where(u => u.Id == callerId)
            .Select(u => new TimesheetExportUserDto(u.Id, u.DisplayName, u.Username))
            .FirstOrDefaultAsync(ct);

        return self is null ? NotFound() : Ok(new List<TimesheetExportUserDto> { self });
    }

    // ── Placeholder for export endpoint (added in Task 4) ───────────────────

    // ── Helpers ─────────────────────────────────────────────────────────────

    private Guid? GetCallerId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
```

- [ ] **Step 2: Build to verify it compiles**

```bash
dotnet build apps/api/TimeSheet.Api.csproj --no-restore -q
```
Expected: `Build succeeded.`

- [ ] **Step 3: Run the subset of tests that cover `/users`**

```bash
dotnet test apps/api.tests/TimeSheet.Api.Tests.csproj --filter "TimesheetExportIntegrationTests&ExportUsers" -v minimal 2>&1 | tail -15
```
Expected: `ExportUsers_Unauthenticated_Returns401`, `ExportUsers_AsAdmin_ReturnsOkWithUsers`, `ExportUsers_AsEmployee_ReturnsSingleSelf` all PASS. Other tests still fail (endpoint missing).

- [ ] **Step 4: Commit**

```bash
git add apps/api/Controllers/TimesheetExportController.cs
git commit -m "feat(api): add GET /timesheets/export/users endpoint with role-scoped user list"
```

---

## Task 4: Add `GET /timesheets/export` endpoint (CSV + Excel + PDF)

**Files:**
- Modify: `apps/api/Controllers/TimesheetExportController.cs`

- [ ] **Step 1: Add the export endpoint and all format helpers to `TimesheetExportController`. Replace the placeholder comment with the following methods:**

```csharp
    // ── GET /api/v1/timesheets/export ────────────────────────────────────────
    // Query params:
    //   fromDate  DateOnly  required
    //   toDate    DateOnly  required  (must be >= fromDate, range <= 366 days)
    //   userId    Guid?     optional  (must be within caller's permitted scope)
    //   format    string    csv | excel | pdf  (default: csv)
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

        // Build the set of user IDs this caller is permitted to export
        var permittedIds = await BuildPermittedIdsAsync(callerId.Value, ct);

        // If a specific user was requested, verify they are in scope
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
            "pdf"             => BuildPdf(rows, fileName),
            _                 => BuildCsv(rows, fileName)
        };
    }

    // ── Data fetch ───────────────────────────────────────────────────────────

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
        // Load timesheets with entries in one query; resolve user display names
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
                    ProjectName      = e.Project.Name,
                    TaskCategoryName = e.TaskCategory.Name,
                    e.Minutes,
                    e.Notes
                }).ToList()
            })
            .ToListAsync(ct);

        // Resolve user display names in one batch
        var userMap = await dbContext.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u =>
                string.IsNullOrWhiteSpace(u.DisplayName) ? u.Username : u.DisplayName, ct);

        var rows = new List<ExportRow>();
        foreach (var ts in raw)
        {
            var employee = userMap.TryGetValue(ts.UserId, out var name) ? name : ts.UserId.ToString();
            foreach (var e in ts.Entries)
            {
                rows.Add(new ExportRow(
                    ts.WorkDate,
                    employee,
                    ts.Status,
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

    // ── CSV ──────────────────────────────────────────────────────────────────

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

    // ── Excel ────────────────────────────────────────────────────────────────

    private IActionResult BuildExcel(List<ExportRow> rows, string fileName)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Timesheets");

        // Header row
        for (var col = 0; col < CsvHeaders.Length; col++)
        {
            var cell = ws.Cell(1, col + 1);
            cell.Value = CsvHeaders[col];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#4F81BD");
            cell.Style.Font.FontColor = XLColor.White;
        }

        // Data rows
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

    // ── PDF ──────────────────────────────────────────────────────────────────

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
                            header.Cell().Background(Colors.Blue.Darken2)
                                .Padding(4).Text(h)
                                .FontColor(Colors.White).Bold().FontSize(7);
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
```

> **Note:** The final `TimesheetExportController.cs` is the combination of the class shell from Task 3 + the methods above. The placeholder comment `// ── Placeholder for export endpoint (added in Task 4)` is replaced by all methods starting at `// ── GET /api/v1/timesheets/export`.

- [ ] **Step 2: Build**

```bash
dotnet build apps/api/TimeSheet.Api.csproj --no-restore -q
```
Expected: `Build succeeded.`

- [ ] **Step 3: Run all export integration tests**

```bash
dotnet test apps/api.tests/TimeSheet.Api.Tests.csproj --filter "TimesheetExportIntegrationTests" -v normal 2>&1 | tail -30
```
Expected: all 10 tests PASS.
> If `Export_AsEmployee_WithAnotherUserId_Returns403` fails because `employee1` user does not exist in the seeded DB, check `CustomWebApplicationFactory` / `AuthIntegrationTests.cs` for the actual seeded employee username and update the test accordingly.

- [ ] **Step 4: Commit**

```bash
git add apps/api/Controllers/TimesheetExportController.cs
git commit -m "feat(api): add GET /timesheets/export endpoint — CSV, Excel, PDF with role scoping"
```

---

## Task 5: Create `TimesheetExportModal.tsx` frontend component

**Files:**
- Create: `apps/web/src/components/TimesheetExportModal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import { AppButton, AppSelect } from "./ui";

interface ExportUser {
  id: string;
  displayName: string;
  username: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function TimesheetExportModal({ open, onClose }: Props) {
  const [fromDate, setFromDate]     = useState(monthStartIso);
  const [toDate, setToDate]         = useState(todayIso);
  const [userId, setUserId]         = useState(""); // "" = all in scope
  const [format, setFormat]         = useState<"csv" | "excel" | "pdf">("csv");
  const [users, setUsers]           = useState<ExportUser[]>([]);
  const [exporting, setExporting]   = useState(false);
  const [error, setError]           = useState("");
  const overlayRef                  = useRef<HTMLDivElement>(null);

  // Fetch available users when modal opens
  useEffect(() => {
    if (!open) return;
    setError("");
    apiFetch("/timesheets/export/users")
      .then(async r => {
        if (r.ok) setUsers(await r.json() as ExportUser[]);
      })
      .catch(() => setError("Failed to load users."));
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleExport() {
    if (!fromDate || !toDate) {
      setError("Please select both From and To dates.");
      return;
    }
    if (toDate < fromDate) {
      setError("To date must be on or after From date.");
      return;
    }
    setError("");
    setExporting(true);

    const params = new URLSearchParams({ fromDate, toDate, format });
    if (userId) params.set("userId", userId);

    try {
      const r = await apiFetch(`/timesheets/export?${params.toString()}`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { message?: string };
        setError(body.message ?? "Export failed. Please try again.");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ext = format === "excel" ? "xlsx" : format;
      a.href = url;
      a.download = `timesheets-${fromDate}-to-${toDate}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  if (!open) return null;

  // Show user picker only when there are multiple users available
  const showUserPicker = users.length > 1;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
        onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                   bg-surface-primary border border-border-default rounded-xl shadow-2xl
                   w-full max-w-md p-6 flex flex-col gap-5"
      >
        <div className="flex items-center justify-between">
          <h2 id="export-modal-title" className="text-base font-semibold text-text-primary">
            Export Timesheets
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="export-from" className="form-label">From</label>
              <input
                id="export-from"
                type="date"
                className="form-input"
                value={fromDate}
                max={toDate || undefined}
                onChange={e => setFromDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="export-to" className="form-label">To</label>
              <input
                id="export-to"
                type="date"
                className="form-input"
                value={toDate}
                min={fromDate || undefined}
                onChange={e => setToDate(e.target.value)}
              />
            </div>
          </div>

          {/* User picker — visible only for managers and admins (> 1 user in scope) */}
          {showUserPicker && (
            <div className="flex flex-col gap-1">
              <label htmlFor="export-user" className="form-label">Employee</label>
              <AppSelect
                id="export-user"
                value={userId}
                onChange={e => setUserId(e.target.value)}
              >
                <option value="">All available</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.displayName || u.username}
                  </option>
                ))}
              </AppSelect>
            </div>
          )}

          {/* Format picker */}
          <div className="flex flex-col gap-1">
            <label htmlFor="export-format" className="form-label">Format</label>
            <AppSelect
              id="export-format"
              value={format}
              onChange={e => setFormat(e.target.value as "csv" | "excel" | "pdf")}
            >
              <option value="csv">CSV (.csv)</option>
              <option value="excel">Excel (.xlsx)</option>
              <option value="pdf">PDF (.pdf)</option>
            </AppSelect>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-danger-text" role="alert">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <AppButton variant="ghost" size="sm" onClick={onClose} disabled={exporting}>
            Cancel
          </AppButton>
          <AppButton variant="primary" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting…" : "Download"}
          </AppButton>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/TimesheetExportModal.tsx
git commit -m "feat(web): add TimesheetExportModal component"
```

---

## Task 6: Wire Export button in Timesheets.tsx

**Files:**
- Modify: `apps/web/src/components/Timesheets.tsx`

- [ ] **Step 1: Add the import for the modal at the top of `Timesheets.tsx` (after existing imports)**

Find the last import line (around line 15) and add:
```tsx
import { TimesheetExportModal } from "./TimesheetExportModal";
```

- [ ] **Step 2: Add `exportOpen` state to the component body**

Inside the `Timesheets` function, after the other `useState` declarations (around line 220), add:
```tsx
const [exportOpen, setExportOpen] = useState(false);
```

- [ ] **Step 3: Replace the stub Export button (line ~725) with the wired version**

Find:
```tsx
<AppButton variant="outline" size="sm" className="ts-toolbar-btn">Export</AppButton>
```

Replace with:
```tsx
<AppButton variant="outline" size="sm" className="ts-toolbar-btn" onClick={() => setExportOpen(true)}>
  Export
</AppButton>
```

- [ ] **Step 4: Mount the modal at the bottom of the component's return JSX**

Find the closing `</>` or last closing tag of the component's return (just before the final `)`). Add the modal just before it:
```tsx
      <TimesheetExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
```

- [ ] **Step 5: Check TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 6: Run integration tests one final time to make sure nothing regressed**

```bash
dotnet test apps/api.tests/TimeSheet.Api.Tests.csproj --filter "TimesheetExportIntegrationTests" -v minimal 2>&1 | tail -15
```
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/Timesheets.tsx
git commit -m "feat(web): wire Export button to TimesheetExportModal in Timesheets page"
```

---

## Task 7: Push and open PR

- [ ] **Step 1: Push branch**

```bash
git push origin feature/AuditLogUpgrade
```

- [ ] **Step 2: Open PR (or confirm it's on an appropriate branch)**

If a separate branch is preferred:
```bash
git checkout -b feature/timesheet-export
git push -u origin feature/timesheet-export
gh pr create \
  --title "feat: timesheet export (CSV / Excel / PDF) with role-based scoping" \
  --body "Closes #<issue>

## Summary
- New \`TimesheetExportController\` with \`GET /timesheets/export/users\` (role-scoped user list) and \`GET /timesheets/export\` (CSV / Excel / PDF download)
- Role scoping: Admin → all users, Manager → direct reports + self, Employee → self only
- \`TimesheetExportModal\` React component with date range, user picker (hidden for employees), and format selector
- 10 integration tests covering auth, format variants, out-of-scope user rejection, and date-range validation

## Test plan
- [ ] Login as admin → Export button → modal shows all employees in picker
- [ ] Login as manager → modal shows only direct reports
- [ ] Login as employee → no user picker, only date range + format
- [ ] Download CSV and verify headers: Date, Employee, Status, Project, Task Category, Minutes, Hours, Notes
- [ ] Download Excel and verify formatting (bold header, alternating rows)
- [ ] Download PDF and verify landscape table layout
- [ ] Try date range > 366 days → 400 error message shown
- [ ] \`dotnet test\` all integration tests pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review Checklist (completed inline)

1. **Spec coverage**
   - ✅ All users can export timesheets: `/timesheets/export` endpoint, all roles covered
   - ✅ Date range selection: `fromDate` + `toDate` query params + frontend inputs
   - ✅ Admin sees all employees: `BuildPermittedIdsAsync` admin branch queries all active users
   - ✅ Manager sees direct reports only: `u.ManagerId == callerId || u.Id == callerId` filter
   - ✅ Employee sees only themselves: single-item list, no user picker in modal
   - ✅ CSV / Excel / PDF formats: all three format helpers implemented
   - ✅ Role enforcement on backend: `BuildPermittedIdsAsync` + forbidden check for out-of-scope `userId`
   - ✅ Frontend user picker hidden for employee (shown only when `users.length > 1`)

2. **Placeholder scan:** No TBD/TODO/incomplete steps found.

3. **Type consistency**
   - `TimesheetExportUserDto(Guid Id, string DisplayName, string Username)` — defined in Task 1, used in Task 3
   - `ExportRow` private record — defined and used within Task 4 only
   - `CsvHeaders` static array — defined once, referenced in CSV, Excel, and PDF helpers
   - `ToStringArray(ExportRow)` — defined once, called in CSV, Excel, and PDF code paths

4. **No ambiguity** — date format is always `yyyy-MM-dd` via `CultureInfo.InvariantCulture` and HTML `type="date"` inputs which always emit ISO format.

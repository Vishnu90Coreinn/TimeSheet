using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/privacy")]
public class PrivacyController(TimeSheetDbContext dbContext, IWebHostEnvironment env) : ControllerBase
{
    [HttpPost("export-request")]
    public async Task<ActionResult<ExportRequestResponse>> RequestExport()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var existing = await dbContext.DataExportRequests
            .Where(r => r.UserId == userId.Value && r.Status == "Pending")
            .FirstOrDefaultAsync();

        if (existing is not null)
            return Ok(ToResponse(existing));

        var request = new DataExportRequest { UserId = userId.Value };
        dbContext.DataExportRequests.Add(request);
        await dbContext.SaveChangesAsync();

        _ = Task.Run(() => ProcessExportAsync(request.Id, userId.Value));

        return Ok(ToResponse(request));
    }

    [HttpGet("export-requests")]
    public async Task<ActionResult<IEnumerable<ExportRequestResponse>>> GetExportRequests()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var requests = await dbContext.DataExportRequests
            .AsNoTracking()
            .Where(r => r.UserId == userId.Value)
            .OrderByDescending(r => r.RequestedAt)
            .Take(10)
            .ToListAsync();

        return Ok(requests.Select(ToResponse));
    }

    [HttpPost("delete-account")]
    public async Task<IActionResult> DeleteAccount()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var user = await dbContext.Users.FindAsync(userId.Value);
        if (user is null) return NotFound();

        user.Username    = $"deleted-{userId}";
        user.DisplayName = "Deleted User";
        user.Email       = $"deleted-{userId}@anon.local";
        user.PasswordHash = string.Empty;

        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("consent")]
    public async Task<IActionResult> LogConsent([FromBody] ConsentRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        dbContext.ConsentLogs.Add(new ConsentLog
        {
            UserId      = userId.Value,
            ConsentType = request.ConsentType,
            Granted     = request.Granted,
            IpAddress   = HttpContext.Connection.RemoteIpAddress?.ToString(),
        });
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    private async Task ProcessExportAsync(Guid requestId, Guid userId)
    {
        try
        {
            var user = await dbContext.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId);

            var entries = await dbContext.TimesheetEntries.AsNoTracking()
                .Include(e => e.Timesheet)
                .Where(e => e.Timesheet.UserId == userId)
                .OrderByDescending(e => e.Timesheet.WorkDate)
                .Take(500)
                .Select(e => new { e.Timesheet.WorkDate, e.Minutes, e.Notes })
                .ToListAsync();

            var leaves = await dbContext.LeaveRequests.AsNoTracking()
                .Where(l => l.UserId == userId)
                .OrderByDescending(l => l.LeaveDate)
                .Take(200)
                .Select(l => new { l.LeaveDate, l.Status })
                .ToListAsync();

            var export = new
            {
                exportedAt = DateTime.UtcNow,
                profile = user is null ? null : new { user.Username, user.DisplayName, user.Email },
                timesheetEntries = entries,
                leaveRequests = leaves,
            };

            var json = JsonSerializer.Serialize(export, new JsonSerializerOptions { WriteIndented = true });

            var webRoot = env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var exportsDir = Path.Combine(webRoot, "exports");
            Directory.CreateDirectory(exportsDir);

            var fileName = $"export-{userId}-{DateTime.UtcNow:yyyyMMddHHmmss}.json";
            await System.IO.File.WriteAllTextAsync(Path.Combine(exportsDir, fileName), json, Encoding.UTF8);

            var req = await dbContext.DataExportRequests.FindAsync(requestId);
            if (req is not null)
            {
                req.Status = "Completed";
                req.CompletedAt = DateTime.UtcNow;
                req.DownloadUrl = $"/exports/{fileName}";
                await dbContext.SaveChangesAsync();
            }
        }
        catch
        {
            var req = await dbContext.DataExportRequests.FindAsync(requestId);
            if (req is not null) { req.Status = "Failed"; await dbContext.SaveChangesAsync(); }
        }
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(sub, out var id) ? id : null;
    }

    private static ExportRequestResponse ToResponse(DataExportRequest r) =>
        new(r.Id, r.Status, r.RequestedAt, r.CompletedAt, r.DownloadUrl);
}

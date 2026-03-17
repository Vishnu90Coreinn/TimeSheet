using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/timesheets/templates")]
public class TimesheetTemplatesController(TimeSheetDbContext dbContext) : ControllerBase
{
    private Guid? GetUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    // GET /api/v1/timesheets/templates
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var templates = await dbContext.TimesheetTemplates.AsNoTracking()
            .Where(t => t.UserId == userId.Value)
            .OrderBy(t => t.Name)
            .ToListAsync();

        var result = templates.Select(t => new TemplateResponse(
            t.Id,
            t.Name,
            t.CreatedAtUtc,
            JsonSerializer.Deserialize<List<TemplateEntryData>>(t.EntriesJson) ?? new List<TemplateEntryData>()
        )).ToList();

        return Ok(result);
    }

    // POST /api/v1/timesheets/templates
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTemplateRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var template = new TimesheetTemplate
        {
            Id = Guid.NewGuid(),
            UserId = userId.Value,
            Name = request.Name,
            EntriesJson = JsonSerializer.Serialize(request.Entries),
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        };

        dbContext.TimesheetTemplates.Add(template);
        await dbContext.SaveChangesAsync();

        var response = new TemplateResponse(
            template.Id,
            template.Name,
            template.CreatedAtUtc,
            request.Entries
        );

        return Ok(response);
    }

    // PUT /api/v1/timesheets/templates/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTemplateRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var template = await dbContext.TimesheetTemplates
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId.Value);

        if (template is null) return NotFound();

        template.Name = request.Name;
        template.EntriesJson = JsonSerializer.Serialize(request.Entries);
        template.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        var response = new TemplateResponse(
            template.Id,
            template.Name,
            template.CreatedAtUtc,
            request.Entries
        );

        return Ok(response);
    }

    // DELETE /api/v1/timesheets/templates/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var template = await dbContext.TimesheetTemplates
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId.Value);

        if (template is null) return NotFound();

        dbContext.TimesheetTemplates.Remove(template);
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    // POST /api/v1/timesheets/templates/{id}/apply
    [HttpPost("{id:guid}/apply")]
    public async Task<IActionResult> Apply(Guid id, [FromBody] ApplyTemplateRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var template = await dbContext.TimesheetTemplates.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId.Value);

        if (template is null) return NotFound();

        var entries = JsonSerializer.Deserialize<List<TemplateEntryData>>(template.EntriesJson)
                      ?? new List<TemplateEntryData>();

        // Find or create the draft timesheet for this user + date
        var timesheet = await dbContext.Timesheets
            .Include(ts => ts.Entries)
            .FirstOrDefaultAsync(ts => ts.UserId == userId.Value && ts.WorkDate == request.WorkDate);

        if (timesheet is null)
        {
            timesheet = new Timesheet
            {
                Id = Guid.NewGuid(),
                UserId = userId.Value,
                WorkDate = request.WorkDate,
                Status = TimesheetStatus.Draft,
            };
            dbContext.Timesheets.Add(timesheet);
        }
        else if (timesheet.Status != TimesheetStatus.Draft)
        {
            return BadRequest(new { message = "Cannot apply to a locked timesheet" });
        }

        int created = 0;
        int skipped = 0;

        foreach (var entry in entries)
        {
            // Skip if exact duplicate already exists (same projectId + categoryId + minutes)
            bool isDuplicate = timesheet.Entries.Any(e =>
                e.ProjectId == entry.ProjectId &&
                e.TaskCategoryId == entry.CategoryId &&
                e.Minutes == entry.Minutes);

            if (isDuplicate)
            {
                skipped++;
                continue;
            }

            var newEntry = new TimesheetEntry
            {
                Id = Guid.NewGuid(),
                TimesheetId = timesheet.Id,
                ProjectId = entry.ProjectId,
                TaskCategoryId = entry.CategoryId,
                Minutes = entry.Minutes,
                Notes = entry.Note,
            };

            dbContext.TimesheetEntries.Add(newEntry);
            created++;
        }

        await dbContext.SaveChangesAsync();

        return Ok(new ApplyTemplateResult(created, skipped, timesheet.Id));
    }
}

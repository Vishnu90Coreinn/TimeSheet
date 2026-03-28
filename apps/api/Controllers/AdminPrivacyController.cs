using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/admin")]
public class AdminPrivacyController(TimeSheetDbContext dbContext) : ControllerBase
{
    private static readonly (string DataType, int DefaultDays)[] Defaults =
    [
        ("timesheets",    2555),  // 7 years
        ("auditlogs",      365),  // 1 year
        ("notifications",   90),  // 3 months
        ("sessions",       180),  // 6 months
    ];

    [HttpGet("retention-policy")]
    public async Task<ActionResult<RetentionPolicyResponse>> GetRetentionPolicy()
    {
        var stored = await dbContext.RetentionPolicies.AsNoTracking().ToListAsync();
        var result = Defaults.Select(d =>
        {
            var row = stored.FirstOrDefault(s => s.DataType == d.DataType);
            return new RetentionPolicyItem(d.DataType, row?.RetentionDays ?? d.DefaultDays);
        }).ToList();
        return Ok(new RetentionPolicyResponse(result));
    }

    [HttpPut("retention-policy")]
    public async Task<ActionResult<RetentionPolicyResponse>> UpdateRetentionPolicy(
        [FromBody] IEnumerable<RetentionPolicyItem> items)
    {
        foreach (var item in items)
        {
            if (item.RetentionDays < 1) continue;
            var row = await dbContext.RetentionPolicies.FirstOrDefaultAsync(r => r.DataType == item.DataType);
            if (row is null)
            {
                dbContext.RetentionPolicies.Add(new RetentionPolicy
                {
                    DataType = item.DataType,
                    RetentionDays = item.RetentionDays,
                });
            }
            else
            {
                row.RetentionDays = item.RetentionDays;
                row.UpdatedAtUtc = DateTime.UtcNow;
            }
        }
        await dbContext.SaveChangesAsync();
        return await GetRetentionPolicy();
    }

    [HttpGet("audit-logs")]
    public async Task<ActionResult<AuditLogPageResponse>> GetAuditLogs(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        page = Math.Max(1, page);

        var query = dbContext.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(a =>
                a.Action.Contains(search) ||
                a.EntityType.Contains(search) ||
                a.EntityId.Contains(search) ||
                (a.Details != null && a.Details.Contains(search)));

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogEntry(a.Id, a.ActorUserId, a.Action, a.EntityType, a.EntityId, a.Details, a.CreatedAtUtc))
            .ToListAsync();

        return Ok(new AuditLogPageResponse(items, total, page, pageSize));
    }
}

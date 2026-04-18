using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/billing")]
public class BillingController(TimeSheetDbContext db) : ControllerBase
{
    // ── helpers ───────────────────────────────────────────────────────────────

    private async Task<Subscription> GetOrCreateSubscriptionAsync(CancellationToken ct)
    {
        var sub = await db.Subscriptions.FirstOrDefaultAsync(ct);
        if (sub is null)
        {
            sub = new Subscription
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                Plan = SubscriptionPlan.Pro,
                Status = SubscriptionStatus.Active,
                UserLimit = 50,
                BillingCycleEnd = DateTime.UtcNow.AddDays(30),
                CreatedAtUtc = DateTime.UtcNow
            };
            db.Subscriptions.Add(sub);
            await db.SaveChangesAsync(ct);
        }
        return sub;
    }

    // ── GET /api/v1/billing/subscription ──────────────────────────────────────

    [HttpGet("subscription")]
    public async Task<IActionResult> GetSubscription(CancellationToken ct = default)
    {
        var sub = await GetOrCreateSubscriptionAsync(ct);

        var activeUsers = await db.Users.CountAsync(u => u.IsActive, ct);
        sub.CurrentUserCount = activeUsers;
        await db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = sub.Id,
            tenantId = sub.TenantId,
            plan = sub.Plan.ToString(),
            status = sub.Status.ToString(),
            userLimit = sub.UserLimit,
            currentUserCount = sub.CurrentUserCount,
            billingCycleEnd = sub.BillingCycleEnd
        });
    }

    // ── GET /api/v1/billing/invoices ──────────────────────────────────────────

    [HttpGet("invoices")]
    public IActionResult GetInvoices()
    {
        var now = DateTime.UtcNow;

        var invoices = Enumerable.Range(0, 6)
            .Select(i =>
            {
                var invoiceMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc)
                    .AddMonths(-i);
                var id = $"INV-{invoiceMonth:yyyy-MM}";
                return new
                {
                    id,
                    date = invoiceMonth.ToString("yyyy-MM-dd"),
                    amount = 299.00,
                    currency = "USD",
                    status = "Paid",
                    downloadUrl = (string?)null
                };
            })
            .ToList();

        return Ok(invoices);
    }

    // ── GET /api/v1/billing/usage ─────────────────────────────────────────────

    [HttpGet("usage")]
    public async Task<IActionResult> GetUsage(CancellationToken ct = default)
    {
        var sub = await GetOrCreateSubscriptionAsync(ct);

        var activeUsers = await db.Users.CountAsync(u => u.IsActive, ct);
        var timesheetCount = await db.Timesheets.CountAsync(ct);
        var storageUsedMb = Math.Round(timesheetCount * 0.08 + activeUsers * 0.5, 1);

        return Ok(new
        {
            activeUsers,
            userLimit = sub.UserLimit,
            timesheetCount,
            storageUsedMb
        });
    }
}

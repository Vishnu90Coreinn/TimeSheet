using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TimeSheet.Domain.Entities;
using TimeSheet.Infrastructure.Persistence;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/push")]
[Authorize]
public class PushController : ControllerBase
{
    private readonly TimeSheetDbContext _db;
    private readonly IConfiguration _config;

    public PushController(TimeSheetDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [HttpGet("vapid-key")]
    public IActionResult GetVapidKey()
    {
        var publicKey = _config["WebPush:VapidPublicKey"] ?? string.Empty;
        return Ok(new { publicKey });
    }

    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscribeRequest req, CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId)) return Unauthorized();

        var existing = await _db.PushSubscriptions
            .FirstOrDefaultAsync(p => p.Endpoint == req.Endpoint, ct);

        if (existing is not null)
        {
            existing.P256dh = req.Keys.P256dh;
            existing.Auth   = req.Keys.Auth;
        }
        else
        {
            _db.PushSubscriptions.Add(new PushSubscription
            {
                UserId   = userId,
                Endpoint = req.Endpoint,
                P256dh   = req.Keys.P256dh,
                Auth     = req.Keys.Auth,
            });
        }

        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpPost("unsubscribe")]
    public async Task<IActionResult> Unsubscribe([FromBody] PushUnsubscribeRequest req, CancellationToken ct)
    {
        var sub = await _db.PushSubscriptions
            .FirstOrDefaultAsync(p => p.Endpoint == req.Endpoint, ct);

        if (sub is not null)
        {
            _db.PushSubscriptions.Remove(sub);
            await _db.SaveChangesAsync(ct);
        }

        return Ok();
    }
}

public record PushSubscribeRequest(string Endpoint, PushSubscribeKeys Keys);
public record PushSubscribeKeys(string P256dh, string Auth);
public record PushUnsubscribeRequest(string Endpoint);

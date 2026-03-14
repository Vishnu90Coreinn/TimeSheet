using System.Security.Claims;
using TimeSheet.Api.Data;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Services;

public interface IAuditService
{
    Task WriteAsync(string action, string entityType, string entityId, string details, ClaimsPrincipal? actor = null);
}

public class AuditService(TimeSheetDbContext dbContext) : IAuditService
{
    public async Task WriteAsync(string action, string entityType, string entityId, string details, ClaimsPrincipal? actor = null)
    {
        Guid? actorUserId = null;
        if (actor is not null)
        {
            var sub = actor.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier || c.Type == System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
            if (Guid.TryParse(sub, out var parsed)) actorUserId = parsed;
        }

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorUserId = actorUserId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Details = details,
            CreatedAtUtc = DateTime.UtcNow
        });
    }
}

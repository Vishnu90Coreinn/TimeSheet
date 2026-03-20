using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using TimeSheet.Domain.Entities;
using TimeSheet.Infrastructure.Persistence;

namespace TimeSheet.Infrastructure.Services;

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
            var sub = actor.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier || c.Type == JwtRegisteredClaimNames.Sub)?.Value;
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

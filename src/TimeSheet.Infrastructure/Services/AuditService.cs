using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using TimeSheet.Domain.Entities;
using TimeSheet.Infrastructure.Persistence;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public interface IAuditService
{
    Task WriteAsync(string action, string entityType, string entityId, string details, ClaimsPrincipal? actor = null);
}

public class AuditService(TimeSheetDbContext dbContext) : IAuditService, AppInterfaces.IAuditService
{
    // Infrastructure interface — used by existing controllers passing ClaimsPrincipal
    public async Task WriteAsync(string action, string entityType, string entityId, string details, ClaimsPrincipal? actor = null)
    {
        Guid? actorUserId = null;
        if (actor is not null)
        {
            var sub = actor.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier || c.Type == JwtRegisteredClaimNames.Sub)?.Value;
            if (Guid.TryParse(sub, out var parsed)) actorUserId = parsed;
        }

        await WriteCore(action, entityType, entityId, details, actorUserId);
    }

    // Application interface — used by MediatR handlers passing Guid?
    Task AppInterfaces.IAuditService.WriteAsync(string action, string entityType, string entityId, string details, Guid? actorUserId)
        => WriteCore(action, entityType, entityId, details, actorUserId);

    private async Task WriteCore(string action, string entityType, string entityId, string details, Guid? actorUserId)
    {
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

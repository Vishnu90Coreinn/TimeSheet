namespace TimeSheet.Application.Common.Interfaces;

public interface IAuditService
{
    Task WriteAsync(string action, string entityType, string entityId, string details, Guid? actorUserId = null);
}

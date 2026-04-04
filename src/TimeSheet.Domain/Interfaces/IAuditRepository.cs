using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IAuditRepository
{
    Task AddAsync(AuditLog auditLog, CancellationToken ct = default);
}

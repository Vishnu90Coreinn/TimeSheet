using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class AuditRepository(TimeSheetDbContext dbContext) : IAuditRepository
{
    public Task AddAsync(AuditLog auditLog, CancellationToken ct = default)
        => dbContext.AuditLogs.AddAsync(auditLog, ct).AsTask();
}

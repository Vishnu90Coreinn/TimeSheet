using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class AdminPrivacyRepository(TimeSheetDbContext dbContext) : IAdminPrivacyRepository
{
    public async Task<IReadOnlyList<RetentionPolicyReadModel>> GetRetentionPoliciesAsync(CancellationToken ct = default)
    {
        return await dbContext.RetentionPolicies.AsNoTracking()
            .Select(r => new RetentionPolicyReadModel(r.DataType, r.RetentionDays))
            .ToListAsync(ct);
    }

    public async Task UpsertRetentionPoliciesAsync(IEnumerable<RetentionPolicyReadModel> items, CancellationToken ct = default)
    {
        foreach (var item in items)
        {
            if (item.RetentionDays < 1)
            {
                continue;
            }

            var row = await dbContext.RetentionPolicies.FirstOrDefaultAsync(r => r.DataType == item.DataType, ct);
            if (row is null)
            {
                dbContext.RetentionPolicies.Add(new RetentionPolicy
                {
                    DataType = item.DataType,
                    RetentionDays = item.RetentionDays
                });
            }
            else
            {
                row.RetentionDays = item.RetentionDays;
                row.UpdatedAtUtc = DateTime.UtcNow;
            }
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<AuditLogPageReadModel> GetAuditLogsAsync(AuditLogFilterReadModel filter, CancellationToken ct = default)
    {
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var page = Math.Max(1, filter.Page);

        var query = ApplyAuditFilter(dbContext.AuditLogs.AsNoTracking(), filter);
        var total = await query.CountAsync(ct);

        var orderedQuery = filter.SortOrder == "asc"
            ? query.OrderBy(a => a.CreatedAtUtc)
            : query.OrderByDescending(a => a.CreatedAtUtc);

        var rawItems = await orderedQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.Id,
                a.ActorUserId,
                a.Action,
                a.EntityType,
                a.EntityId,
                a.Details,
                a.CreatedAtUtc,
                a.HasFieldChanges
            })
            .ToListAsync(ct);

        var actorMap = await GetActorMapAsync(rawItems.Where(i => i.ActorUserId.HasValue).Select(i => i.ActorUserId!.Value), ct);
        var items = rawItems.Select(i =>
        {
            (string DisplayName, string Username) actor =
                i.ActorUserId.HasValue && actorMap.TryGetValue(i.ActorUserId.Value, out var info)
                    ? info
                    : default;

            return new AuditLogListItemReadModel(
                i.Id,
                i.ActorUserId,
                actor.DisplayName,
                actor.Username,
                i.Action,
                i.EntityType,
                i.EntityId,
                i.Details,
                i.CreatedAtUtc,
                i.HasFieldChanges);
        }).ToList();

        return new AuditLogPageReadModel(items, total, page, pageSize);
    }

    public async Task<IReadOnlyList<AuditLogChangeReadModel>?> GetAuditChangesAsync(Guid auditLogId, CancellationToken ct = default)
    {
        var exists = await dbContext.AuditLogs.AsNoTracking().AnyAsync(a => a.Id == auditLogId, ct);
        if (!exists)
        {
            return null;
        }

        return await dbContext.AuditLogChanges.AsNoTracking()
            .Where(c => c.AuditLogId == auditLogId)
            .OrderBy(c => c.FieldName)
            .Select(c => new AuditLogChangeReadModel(
                c.FieldName,
                c.IsMasked ? "[REDACTED]" : c.OldValue,
                c.IsMasked ? "[REDACTED]" : c.NewValue,
                c.ValueType))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<AuditLogListItemReadModel>> GetEntityHistoryAsync(
        string entityType,
        string entityId,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        page = Math.Max(1, page);

        var rawItems = await dbContext.AuditLogs.AsNoTracking()
            .Where(a => a.EntityType == entityType && a.EntityId == entityId)
            .OrderByDescending(a => a.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.Id,
                a.ActorUserId,
                a.Action,
                a.EntityType,
                a.EntityId,
                a.Details,
                a.CreatedAtUtc,
                a.HasFieldChanges
            })
            .ToListAsync(ct);

        var actorMap = await GetActorMapAsync(rawItems.Where(i => i.ActorUserId.HasValue).Select(i => i.ActorUserId!.Value), ct);

        return rawItems.Select(i =>
        {
            (string DisplayName, string Username) actor =
                i.ActorUserId.HasValue && actorMap.TryGetValue(i.ActorUserId.Value, out var info)
                    ? info
                    : default;

            return new AuditLogListItemReadModel(
                i.Id,
                i.ActorUserId,
                actor.DisplayName,
                actor.Username,
                i.Action,
                i.EntityType,
                i.EntityId,
                i.Details,
                i.CreatedAtUtc,
                i.HasFieldChanges);
        }).ToList();
    }

    public async Task<AuditLogStatsReadModel> GetAuditStatsAsync(CancellationToken ct = default)
    {
        var total = await dbContext.AuditLogs.AsNoTracking().CountAsync(ct);
        var lastEventAt = await dbContext.AuditLogs.AsNoTracking()
            .OrderByDescending(a => a.CreatedAtUtc)
            .Select(a => (DateTime?)a.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);
        var retentionDays = await dbContext.RetentionPolicies.AsNoTracking()
            .Where(r => r.DataType == "auditlogs")
            .Select(r => (int?)r.RetentionDays)
            .FirstOrDefaultAsync(ct) ?? 365;

        return new AuditLogStatsReadModel(total, lastEventAt, retentionDays);
    }

    public async Task<IReadOnlyList<AuditActorReadModel>> GetAuditActorsAsync(CancellationToken ct = default)
    {
        var actorIds = await dbContext.AuditLogs.AsNoTracking()
            .Where(a => a.ActorUserId.HasValue)
            .Select(a => a.ActorUserId!.Value)
            .Distinct()
            .ToListAsync(ct);

        return await dbContext.Users.AsNoTracking()
            .Where(u => actorIds.Contains(u.Id))
            .OrderBy(u => u.DisplayName)
            .Select(u => new AuditActorReadModel(u.Id, u.DisplayName, u.Username))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<AuditLogExportItemReadModel>> GetAuditLogsForExportAsync(
        AuditLogFilterReadModel filter,
        CancellationToken ct = default)
    {
        var query = ApplyAuditFilter(dbContext.AuditLogs.AsNoTracking(), filter)
            .OrderByDescending(a => a.CreatedAtUtc);

        var rawItems = await query
            .Select(a => new
            {
                a.Id,
                a.ActorUserId,
                a.Action,
                a.EntityType,
                a.EntityId,
                a.Details,
                a.CreatedAtUtc
            })
            .ToListAsync(ct);

        var actorMap = await dbContext.Users.AsNoTracking()
            .Where(u => rawItems.Where(i => i.ActorUserId.HasValue).Select(i => i.ActorUserId!.Value).Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);

        return rawItems.Select(i =>
            new AuditLogExportItemReadModel(
                i.Id,
                i.ActorUserId,
                i.ActorUserId.HasValue && actorMap.TryGetValue(i.ActorUserId.Value, out var name) ? name : null,
                i.Action,
                i.EntityType,
                i.EntityId,
                i.Details,
                i.CreatedAtUtc)).ToList();
    }

    private static IQueryable<AuditLog> ApplyAuditFilter(IQueryable<AuditLog> query, AuditLogFilterReadModel filter)
    {
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            query = query.Where(a =>
                a.Action.Contains(filter.Search) ||
                a.EntityType.Contains(filter.Search) ||
                a.EntityId.Contains(filter.Search) ||
                (a.Details != null && a.Details.Contains(filter.Search)));
        }

        if (filter.ActorId.HasValue)
        {
            query = query.Where(a => a.ActorUserId == filter.ActorId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Action))
        {
            var actions = filter.Action.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            query = actions.Length == 1
                ? query.Where(a => a.Action == actions[0])
                : query.Where(a => actions.Contains(a.Action));
        }

        if (!string.IsNullOrWhiteSpace(filter.EntityType))
        {
            var types = filter.EntityType.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            query = types.Length == 1
                ? query.Where(a => a.EntityType == types[0])
                : query.Where(a => types.Contains(a.EntityType));
        }

        if (filter.FromDate.HasValue)
        {
            query = query.Where(a => a.CreatedAtUtc >= filter.FromDate.Value.ToUniversalTime());
        }

        if (filter.ToDate.HasValue)
        {
            query = query.Where(a => a.CreatedAtUtc < filter.ToDate.Value.ToUniversalTime().AddDays(1));
        }

        return query;
    }

    private async Task<Dictionary<Guid, (string DisplayName, string Username)>> GetActorMapAsync(
        IEnumerable<Guid> actorIds,
        CancellationToken ct)
    {
        var ids = actorIds.Distinct().ToList();
        if (ids.Count == 0)
        {
            return [];
        }

        return await dbContext.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName, u.Username })
            .ToDictionaryAsync(u => u.Id, u => (u.DisplayName, u.Username), ct);
    }
}

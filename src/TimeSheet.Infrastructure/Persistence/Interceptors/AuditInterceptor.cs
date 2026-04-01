using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Common;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Interceptors;

public sealed class AuditInterceptor(
    ICurrentUserService currentUser,
    ICorrelationIdAccessor correlationIdAccessor) : SaveChangesInterceptor
{
    private static readonly HashSet<string> IgnoredFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "RowVersion",
        "UpdatedAtUtc",
        "CreatedAtUtc",
        "PasswordHash",
        "ConcurrencyStamp",
        "NormalizedEmail",
        "NormalizedUserName"
    };

    private static readonly HashSet<Type> TrackedTypes =
    [
        typeof(User),
        typeof(Timesheet),
        typeof(TimesheetEntry),
        typeof(Project),
        typeof(LeaveRequest),
        typeof(WorkPolicy)
    ];

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is not TimeSheetDbContext dbContext)
        {
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }

        var auditLogs = BuildAuditLogs(dbContext);
        if (auditLogs.Count > 0)
        {
            dbContext.AuditLogs.AddRange(auditLogs);
        }

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private List<AuditLog> BuildAuditLogs(TimeSheetDbContext dbContext)
    {
        dbContext.ChangeTracker.DetectChanges();
        var logs = new List<AuditLog>();

        foreach (var entry in dbContext.ChangeTracker.Entries())
        {
            if (!TrackedTypes.Contains(entry.Entity.GetType()))
            {
                continue;
            }

            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted))
            {
                continue;
            }

            var action = entry.State switch
            {
                EntityState.Added => "Created",
                EntityState.Deleted => "Deleted",
                _ => "Updated"
            };

            var entityType = entry.Entity.GetType().Name;
            var changes = BuildChanges(entry);

            if (action == "Updated" && changes.Count == 0)
            {
                continue;
            }

            logs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                ActorUserId = currentUser.UserId == Guid.Empty ? null : currentUser.UserId,
                Action = $"{entityType}{action}",
                EntityType = entityType,
                EntityId = GetPrimaryKeyValue(entry),
                HasFieldChanges = changes.Count > 0,
                SourceContext = "EFInterceptor",
                CorrelationId = correlationIdAccessor.Current,
                CreatedAtUtc = DateTime.UtcNow,
                Changes = changes
            });
        }

        return logs;
    }

    private static List<AuditLogChange> BuildChanges(EntityEntry entry)
    {
        var changes = new List<AuditLogChange>();
        var entityType = entry.Entity.GetType();

        foreach (var property in entry.Properties)
        {
            var propertyName = property.Metadata.Name;
            if (IgnoredFields.Contains(propertyName))
            {
                continue;
            }

            var isSensitive = SensitiveFieldCache.IsSensitive(entityType, propertyName);

            string? oldValue = null;
            string? newValue = null;

            switch (entry.State)
            {
                case EntityState.Added:
                    newValue = isSensitive ? "[REDACTED]" : FormatValue(property.CurrentValue);
                    break;
                case EntityState.Deleted:
                    oldValue = isSensitive ? "[REDACTED]" : FormatValue(property.OriginalValue);
                    break;
                case EntityState.Modified:
                    if (!property.IsModified || Equals(property.OriginalValue, property.CurrentValue))
                    {
                        continue;
                    }

                    oldValue = isSensitive ? "[REDACTED]" : FormatValue(property.OriginalValue);
                    newValue = isSensitive ? "[REDACTED]" : FormatValue(property.CurrentValue);
                    break;
            }

            changes.Add(new AuditLogChange
            {
                Id = Guid.NewGuid(),
                FieldName = propertyName,
                OldValue = oldValue,
                NewValue = newValue,
                ValueType = property.Metadata.ClrType.Name,
                IsMasked = isSensitive
            });
        }

        return changes;
    }

    private static string GetPrimaryKeyValue(EntityEntry entry)
    {
        var primaryKey = entry.Metadata.FindPrimaryKey();
        if (primaryKey is null)
        {
            return string.Empty;
        }

        return string.Join(
            ",",
            primaryKey.Properties.Select(p => entry.Property(p.Name).CurrentValue?.ToString() ?? string.Empty));
    }

    private static string? FormatValue(object? value) => value switch
    {
        null => null,
        DateTime dateTime => dateTime.ToString("O"),
        DateTimeOffset dateTimeOffset => dateTimeOffset.ToString("O"),
        _ => value.ToString()
    };
}

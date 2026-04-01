# Audit Trail Upgrade — Field-Level Change Tracking

**Branch:** `feature/AuditLogUpgrade`
**Status:** Plan / Design
**Target:** Sprint 42

---

## Current State Assessment

The existing audit system is a flat log:

```
AuditLog: Id | ActorUserId | Action | EntityType | EntityId | Details (free-text/JSON blob) | CreatedAtUtc
```

`Details` is manually constructed per controller — inconsistent, unqueryable, and missing before/after values.
The upgrade must be **non-breaking** (old string-based logs stay valid) while layering structured field tracking on top.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     HTTP Request                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  apps/api  (Controllers / MediatR Handlers)                 │
│  Existing: auditService.WriteAsync("UserUpdated", ...)      │
│  NEW:      AuditInterceptor (automatic, zero-touch)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  TimeSheet.Application                                      │
│  IAuditService (extended) + IAuditQueue                     │
└────────────┬──────────────────────────────┬─────────────────┘
             │                              │
┌────────────▼──────────┐    ┌─────────────▼─────────────────┐
│ TimeSheet.Domain       │    │ TimeSheet.Infrastructure       │
│ AuditLog (upgraded)    │    │ AuditInterceptor               │
│ AuditLogChange (new)   │    │ AuditService (upgraded)        │
│ SensitiveAttribute     │    │ AuditBackgroundQueue           │
└───────────────────────┘    └───────────────────────────────┘
```

---

## 1. Database Schema

### Upgrade `AuditLogs` table (backward compatible)

```sql
ALTER TABLE AuditLogs ADD
    SourceContext   NVARCHAR(100) NULL,   -- 'EFInterceptor' | 'ManualCall' | 'BackgroundJob'
    CorrelationId   NVARCHAR(50)  NULL,   -- links to HTTP request trace
    IpAddress       NVARCHAR(45)  NULL,
    UserAgent       NVARCHAR(500) NULL,
    HasFieldChanges BIT NOT NULL DEFAULT 0;
```

### New `AuditLogChanges` table (field-level diff rows)

```sql
CREATE TABLE AuditLogChanges (
    Id          UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    AuditLogId  UNIQUEIDENTIFIER NOT NULL,
    FieldName   NVARCHAR(200)    NOT NULL,
    OldValue    NVARCHAR(MAX)    NULL,
    NewValue    NVARCHAR(MAX)    NULL,
    ValueType   NVARCHAR(50)     NULL,    -- 'String'|'Int'|'Bool'|'DateTime'|'Guid'
    IsMasked    BIT NOT NULL DEFAULT 0,

    CONSTRAINT FK_AuditLogChanges_AuditLogs
        FOREIGN KEY (AuditLogId) REFERENCES AuditLogs(Id) ON DELETE CASCADE,

    INDEX IX_AuditLogChanges_AuditLogId (AuditLogId),
    INDEX IX_AuditLogChanges_FieldName  (FieldName)
);
```

**Design decision — normalized rows vs JSON column:**

| Approach | Pros | Cons |
|---|---|---|
| Normalized rows (chosen) | Queryable by field name; index-seekable | More rows (~8x per update) |
| JSON column | Compact; single row | `JSON_VALUE()` is not index-seekable; can't filter `WHERE FieldName = 'X'` efficiently |

At 10k updates/day with avg 8 changed fields = 80k rows/day — well within SQL Server capacity and covered by the existing 1-year retention policy.

---

## 2. Domain Layer Changes

### `src/TimeSheet.Domain/Entities/AuditLog.cs` — upgrade in place

```csharp
namespace TimeSheet.Domain.Entities;

public class AuditLog
{
    public Guid Id { get; set; }
    public Guid? ActorUserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string? Details { get; set; }           // kept for backward compat
    public bool HasFieldChanges { get; set; }
    public string SourceContext { get; set; } = "ManualCall";
    public string? CorrelationId { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<AuditLogChange> Changes { get; set; } = [];
}

public class AuditLogChange
{
    public Guid Id { get; set; }
    public Guid AuditLogId { get; set; }
    public string FieldName { get; set; } = string.Empty;
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? ValueType { get; set; }
    public bool IsMasked { get; set; }

    // Navigation
    public AuditLog AuditLog { get; set; } = null!;
}
```

### `src/TimeSheet.Domain/Common/SensitiveAttribute.cs` — new file

Marks entity properties that must never appear as plain text in audit logs.

```csharp
namespace TimeSheet.Domain.Common;

[AttributeUsage(AttributeTargets.Property)]
public sealed class SensitiveAttribute : Attribute
{
    public SensitiveDataReason Reason { get; }
    public SensitiveAttribute(SensitiveDataReason reason = SensitiveDataReason.PII)
        => Reason = reason;
}

public enum SensitiveDataReason { PII, Credential, Financial }
```

Apply to entities:

```csharp
public class User
{
    [Sensitive(SensitiveDataReason.Credential)]
    public string PasswordHash { get; set; } = string.Empty;

    [Sensitive(SensitiveDataReason.PII)]
    public string? PersonalEmail { get; set; }
}
```

---

## 3. Capture Mechanism — EF Core `ISaveChangesInterceptor`

### Capture strategy decision

| Approach | Pros | Cons |
|---|---|---|
| `ISaveChangesInterceptor` (chosen) | Automatic; catches ALL saves including direct DbContext mutations | Runs inside transaction; must be fast |
| Domain Events | Explicit and clean | Every command must manually raise events; misses direct DbContext mutations |
| Manual `WriteAsync` calls | Already in place for semantic events | Proven insufficient; misses partial changes; error-prone |

**Chosen:** Interceptor for field-level tracking; manual `WriteAsync` calls remain for semantic events (`TimesheetSubmitted`, `UserCreated`). They complement each other.

### `src/TimeSheet.Infrastructure/Persistence/Interceptors/AuditInterceptor.cs`

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Reflection;
using TimeSheet.Domain.Common;
using TimeSheet.Domain.Entities;

namespace TimeSheet.Infrastructure.Persistence.Interceptors;

public sealed class AuditInterceptor(ICurrentUserService currentUser, ICorrelationIdAccessor correlationId)
    : SaveChangesInterceptor
{
    // Infrastructure noise — never audit these
    private static readonly HashSet<string> IgnoredFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "RowVersion", "UpdatedAtUtc", "CreatedAtUtc", "PasswordHash",
        "ConcurrencyStamp", "NormalizedEmail", "NormalizedUserName"
    };

    // Opt-in list — only track meaningful entities
    private static readonly HashSet<Type> TrackedTypes =
    [
        typeof(User), typeof(Timesheet), typeof(TimesheetEntry),
        typeof(Project), typeof(LeaveRequest), typeof(WorkPolicy)
    ];

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is not TimeSheetDbContext ctx)
            return base.SavingChangesAsync(eventData, result, cancellationToken);

        var auditEntries = BuildAuditEntries(ctx);
        if (auditEntries.Count > 0)
            ctx.AuditLogs.AddRange(auditEntries);

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private List<AuditLog> BuildAuditEntries(TimeSheetDbContext ctx)
    {
        ctx.ChangeTracker.DetectChanges();
        var entries = new List<AuditLog>();

        foreach (var entry in ctx.ChangeTracker.Entries())
        {
            if (!TrackedTypes.Contains(entry.Entity.GetType())) continue;
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted)) continue;

            var action = entry.State switch
            {
                EntityState.Added   => "Created",
                EntityState.Deleted => "Deleted",
                _                   => "Updated"
            };

            var entityType = entry.Entity.GetType().Name;
            var changes = BuildChanges(entry);

            // Only emit "Updated" if actual field changes exist
            if (action == "Updated" && changes.Count == 0) continue;

            entries.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                ActorUserId = currentUser.UserId,
                Action = $"{entityType}{action}",   // e.g. "TimesheetEntryUpdated"
                EntityType = entityType,
                EntityId = GetPrimaryKey(entry),
                HasFieldChanges = changes.Count > 0,
                SourceContext = "EFInterceptor",
                CorrelationId = correlationId.Current,
                CreatedAtUtc = DateTime.UtcNow,
                Changes = changes
            });
        }

        return entries;
    }

    private static List<AuditLogChange> BuildChanges(
        Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry)
    {
        var changes = new List<AuditLogChange>();
        var entityType = entry.Entity.GetType();

        foreach (var prop in entry.Properties)
        {
            var propName = prop.Metadata.Name;
            if (IgnoredFields.Contains(propName)) continue;

            // [Sensitive] lookup — cache this in production via SensitiveFieldCache
            var clrProp = entityType.GetProperty(propName);
            var isSensitive = clrProp?.GetCustomAttribute<SensitiveAttribute>() is not null;

            string? oldVal = null;
            string? newVal = null;

            switch (entry.State)
            {
                case EntityState.Added:
                    newVal = isSensitive ? "[REDACTED]" : FormatValue(prop.CurrentValue);
                    break;
                case EntityState.Deleted:
                    oldVal = isSensitive ? "[REDACTED]" : FormatValue(prop.OriginalValue);
                    break;
                case EntityState.Modified:
                    if (!prop.IsModified) continue;
                    if (Equals(prop.OriginalValue, prop.CurrentValue)) continue;
                    oldVal = isSensitive ? "[REDACTED]" : FormatValue(prop.OriginalValue);
                    newVal = isSensitive ? "[REDACTED]" : FormatValue(prop.CurrentValue);
                    break;
            }

            changes.Add(new AuditLogChange
            {
                Id = Guid.NewGuid(),
                FieldName = propName,
                OldValue = oldVal,
                NewValue = newVal,
                ValueType = prop.CurrentValue?.GetType().Name
                            ?? prop.OriginalValue?.GetType().Name,
                IsMasked = isSensitive
            });
        }

        return changes;
    }

    private static string GetPrimaryKey(
        Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry)
    {
        var key = entry.Metadata.FindPrimaryKey();
        if (key is null) return string.Empty;
        return string.Join(",",
            key.Properties.Select(p => entry.Property(p.Name).CurrentValue?.ToString() ?? ""));
    }

    private static string? FormatValue(object? val) => val switch
    {
        null => null,
        DateTime dt => dt.ToString("O"),       // ISO 8601 — consistent with UTC serializer
        DateTimeOffset dto => dto.ToString("O"),
        _ => val.ToString()
    };
}
```

> **Production note:** Reflection in `BuildChanges` is called on every save. Add a static
> `ConcurrentDictionary<(Type, string), bool> SensitiveFieldCache` to cache the attribute
> lookup — one reflection call per property per app lifetime.

---

## 4. Performance Strategy — Two-Tier Audit

### Tier 1 — Same-transaction (default, user-initiated HTTP requests)

The interceptor adds audit rows to the same `SaveChanges` call. Audit and data commit atomically — if the main change rolls back, the audit entry rolls back too. This is the correct compliance behaviour.

### Tier 2 — Fire-and-forget queue (background jobs / bulk operations)

```csharp
// src/TimeSheet.Application/Common/Interfaces/IAuditQueue.cs
public interface IAuditQueue
{
    void Enqueue(AuditEntry entry);
}

// src/TimeSheet.Infrastructure/Services/AuditBackgroundQueue.cs
public sealed class AuditBackgroundQueue : BackgroundService, IAuditQueue
{
    private readonly Channel<AuditEntry> _channel =
        Channel.CreateBounded<AuditEntry>(new BoundedChannelOptions(5_000)
        {
            FullMode = BoundedChannelFullMode.DropOldest  // never block the caller
        });

    public void Enqueue(AuditEntry entry) =>
        _channel.Writer.TryWrite(entry);   // non-blocking

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var batch in _channel.Reader
            .ReadAllAsync(stoppingToken)
            .Buffer(50, TimeSpan.FromSeconds(2)))   // micro-batch: 50 rows or 2s
        {
            await using var scope = /* create IServiceScope */;
            var ctx = scope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
            await ctx.AuditLogs.AddRangeAsync(batch.Select(ToAuditLog));
            await ctx.SaveChangesAsync(stoppingToken);
        }
    }
}
```

**Rule:** Background jobs (e.g., `RetentionEnforcementService`) use `IAuditQueue.Enqueue()`.
User-facing HTTP requests use the interceptor. Never mix them in the same code path.

---

## 5. Updated Application Interface

```csharp
// src/TimeSheet.Application/Common/Interfaces/IAuditService.cs
namespace TimeSheet.Application.Common.Interfaces;

public interface IAuditService
{
    // Existing — kept for backward compat (used by EventHandlers, no field changes)
    Task WriteAsync(string action, string entityType, string entityId,
                    string details, Guid? actorUserId = null);

    // New — structured field changes (when manual diff is preferred over interceptor)
    Task WriteWithChangesAsync(string action, string entityType, string entityId,
                               IReadOnlyList<FieldChange> changes, Guid? actorUserId = null);
}

public record FieldChange(string FieldName, string? OldValue, string? NewValue);
```

---

## 6. EF Configuration

```csharp
// src/TimeSheet.Infrastructure/Persistence/Configurations/AuditLogConfiguration.cs
public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Action).HasMaxLength(100).IsRequired();
        builder.Property(a => a.EntityType).HasMaxLength(100).IsRequired();
        builder.Property(a => a.EntityId).HasMaxLength(200).IsRequired();
        builder.Property(a => a.SourceContext).HasMaxLength(100);
        builder.Property(a => a.CorrelationId).HasMaxLength(50);
        builder.Property(a => a.IpAddress).HasMaxLength(45);

        builder.HasMany(a => a.Changes)
               .WithOne(c => c.AuditLog)
               .HasForeignKey(c => c.AuditLogId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(a => a.CreatedAtUtc);
        builder.HasIndex(a => new { a.EntityType, a.EntityId });
        builder.HasIndex(a => a.ActorUserId);
    }
}

public class AuditLogChangeConfiguration : IEntityTypeConfiguration<AuditLogChange>
{
    public void Configure(EntityTypeBuilder<AuditLogChange> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.FieldName).HasMaxLength(200).IsRequired();
        builder.Property(c => c.ValueType).HasMaxLength(50);

        builder.HasIndex(c => c.AuditLogId);
        builder.HasIndex(c => c.FieldName);
    }
}
```

---

## 7. Migration

**Migration name:** `Sprint42_AuditFieldChanges`

> **Critical:** Always generate both `Sprint42_AuditFieldChanges.cs` AND
> `Sprint42_AuditFieldChanges.Designer.cs`. Codex agents sometimes omit the Designer file.

```csharp
migrationBuilder.AddColumn<bool>(
    name: "HasFieldChanges", table: "AuditLogs", nullable: false, defaultValue: false);

migrationBuilder.AddColumn<string>(
    name: "SourceContext", table: "AuditLogs", maxLength: 100, nullable: true);

migrationBuilder.AddColumn<string>(
    name: "CorrelationId", table: "AuditLogs", maxLength: 50, nullable: true);

migrationBuilder.CreateTable(
    name: "AuditLogChanges",
    columns: t => new
    {
        Id         = t.Column<Guid>(nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
        AuditLogId = t.Column<Guid>(nullable: false),
        FieldName  = t.Column<string>(maxLength: 200, nullable: false),
        OldValue   = t.Column<string>(nullable: true),
        NewValue   = t.Column<string>(nullable: true),
        ValueType  = t.Column<string>(maxLength: 50, nullable: true),
        IsMasked   = t.Column<bool>(nullable: false, defaultValue: false)
    },
    constraints: t =>
    {
        t.PrimaryKey("PK_AuditLogChanges", x => x.Id);
        t.ForeignKey(
            name: "FK_AuditLogChanges_AuditLogs_AuditLogId",
            column: x => x.AuditLogId,
            principalTable: "AuditLogs",
            principalColumn: "Id",
            onDelete: ReferentialAction.Cascade);
    });

migrationBuilder.CreateIndex("IX_AuditLogChanges_AuditLogId", "AuditLogChanges", "AuditLogId");
migrationBuilder.CreateIndex("IX_AuditLogChanges_FieldName",  "AuditLogChanges", "FieldName");
```

---

## 8. API Design

All endpoints under `/api/v1/admin/` — admin-only (`[Authorize(Roles = "admin")]`).

| Method | Route | Description |
|---|---|---|
| `GET` | `/audit-logs` | Existing — add `hasFieldChanges` to response DTO |
| `GET` | `/audit-logs/{id}/changes` | **NEW** — field-level changes for one log entry |
| `GET` | `/audit-logs/entities/{entityType}/{entityId}` | **NEW** — full history of one entity |
| `GET` | `/audit-logs/actors` | Existing |
| `GET` | `/audit-logs/stats` | Existing |
| `GET` | `/audit-logs/export` | Existing — extend CSV to include field changes |

### New endpoint implementations

```csharp
// GET /api/v1/admin/audit-logs/{id}/changes
[HttpGet("audit-logs/{id:guid}/changes")]
public async Task<ActionResult<IReadOnlyList<AuditChangeDto>>> GetAuditChanges(Guid id)
{
    var log = await dbContext.AuditLogs
        .AsNoTracking()
        .Include(a => a.Changes)
        .FirstOrDefaultAsync(a => a.Id == id);

    if (log is null) return NotFound();

    return Ok(log.Changes.Select(c => new AuditChangeDto(
        c.FieldName,
        c.IsMasked ? "[REDACTED]" : c.OldValue,
        c.IsMasked ? "[REDACTED]" : c.NewValue,
        c.ValueType
    )).ToList());
}

// GET /api/v1/admin/audit-logs/entities/{entityType}/{entityId}
[HttpGet("audit-logs/entities/{entityType}/{entityId}")]
public async Task<ActionResult<IReadOnlyList<AuditLogEntry>>> GetEntityHistory(
    string entityType, string entityId,
    [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
{
    pageSize = Math.Clamp(pageSize, 1, 100);
    page = Math.Max(1, page);

    var items = await dbContext.AuditLogs
        .AsNoTracking()
        .Where(a => a.EntityType == entityType && a.EntityId == entityId)
        .OrderByDescending(a => a.CreatedAtUtc)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .Select(a => new AuditLogEntry(
            a.Id, a.ActorUserId, null, null,
            a.Action, a.EntityType, a.EntityId,
            a.Details, a.CreatedAtUtc))
        .ToListAsync();

    return Ok(items);
}
```

---

## 9. Frontend — `AuditLogViewer.tsx` Upgrade

The existing component has the table, pagination, filters, and drawer shell. The upgrade adds a lazy-loaded field-level diff table inside the drawer.

### New TypeScript types

```tsx
interface AuditLogChange {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  valueType: string | null;
}

// Extend existing AuditLogEntry
interface AuditLogEntry {
  // ...existing fields...
  hasFieldChanges: boolean;
}
```

### `ChangesDiffTable` component

```tsx
function ChangesDiffTable({ logId }: { logId: string }) {
  const [changes, setChanges] = useState<AuditLogChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AuditLogChange[]>(`/api/v1/admin/audit-logs/${logId}/changes`)
      .then(setChanges)
      .finally(() => setLoading(false));
  }, [logId]);

  if (loading)
    return <div className="text-sm text-gray-400 py-4 text-center">Loading changes…</div>;

  if (changes.length === 0)
    return (
      <div className="text-sm text-gray-400 py-4 text-center">
        No field-level changes recorded
      </div>
    );

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="text-left py-2 pr-4 font-medium text-gray-500 w-[30%]">Field</th>
          <th className="text-left py-2 pr-4 font-medium text-gray-500 w-[35%]">Before</th>
          <th className="text-left py-2 font-medium text-gray-500 w-[35%]">After</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c) => (
          <tr key={c.fieldName} className="border-b border-gray-100">
            <td className="py-2 pr-4 font-mono text-xs text-gray-700">
              {humaniseField(c.fieldName)}
            </td>
            <td className="py-2 pr-4">
              <DiffCell value={c.oldValue} type="old" />
            </td>
            <td className="py-2">
              <DiffCell value={c.newValue} type="new" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DiffCell({ value, type }: { value: string | null; type: "old" | "new" }) {
  if (value === null)
    return <span className="text-gray-300 italic text-xs">—</span>;
  if (value === "[REDACTED]")
    return <span className="text-gray-400 text-xs font-mono">[REDACTED]</span>;

  const cls =
    type === "old"
      ? "bg-red-50 text-red-800 px-1.5 py-0.5 rounded text-xs font-mono line-through decoration-red-400"
      : "bg-green-50 text-green-800 px-1.5 py-0.5 rounded text-xs font-mono";

  return <span className={cls}>{value}</span>;
}

function humaniseField(name: string): string {
  // "HoursWorked" → "Hours Worked", "projectId" → "Project"
  return name
    .replace(/Id$/, "")
    .replace(/([A-Z])/g, " $1")
    .trim();
}
```

### Drawer integration

Replace the raw `Details` text block in the existing drawer with:

```tsx
{selectedEntry.hasFieldChanges ? (
  <ChangesDiffTable logId={selectedEntry.id} />
) : (
  <p className="text-sm text-gray-600 break-words">
    {selectedEntry.details ?? "No additional details"}
  </p>
)}
```

Lazy-loaded — the diff fetch only fires when a row is clicked.

---

## 10. Step-by-Step Implementation Plan

```
Phase 1 — Schema + Domain  (no behavior change; safe to ship)
──────────────────────────────────────────────────────────────
[1] Add AuditLogChange entity to src/TimeSheet.Domain/Entities/AuditLog.cs
[2] Add SensitiveAttribute + SensitiveFieldCache to src/TimeSheet.Domain/Common/
[3] Apply [Sensitive] to User.PasswordHash (and any PII fields)
[4] Update AuditLogConfiguration.cs (add relationship, new indexes)
[5] Add AuditLogChangeConfiguration.cs
[6] Add Sprint42_AuditFieldChanges migration (.cs + .Designer.cs — both required)
[7] Add AuditLogChanges DbSet to TimeSheetDbContext

Phase 2 — Interceptor  (starts capturing field changes automatically)
──────────────────────────────────────────────────────────────
[8]  Add ICurrentUserService interface to Application/Common/Interfaces/
[9]  Add HttpContextCurrentUserService implementation to Infrastructure/Services/
[10] Add ICorrelationIdAccessor interface (reads from existing CorrelationIdMiddleware)
[11] Build AuditInterceptor in Infrastructure/Persistence/Interceptors/
[12] Register interceptor in Infrastructure/DependencyInjection.cs
     (AddInterceptors — must be scoped to avoid capturing stale DbContext)
[13] Verify with integration test: save User → AuditLogChanges rows created for modified fields

Phase 3 — API upgrade
──────────────────────────────────────────────────────────────
[14] Add GET /audit-logs/{id}/changes endpoint to AdminPrivacyController
[15] Add GET /audit-logs/entities/{entityType}/{entityId} endpoint
[16] Add hasFieldChanges to AuditLogEntry DTO response
[17] Extend export CSV to include field change columns (optional)

Phase 4 — Frontend upgrade
──────────────────────────────────────────────────────────────
[18] Add AuditLogChange interface to AuditLogViewer.tsx
[19] Extend AuditLogEntry interface with hasFieldChanges
[20] Add ChangesDiffTable + DiffCell + humaniseField components
[21] Wire hasFieldChanges → lazy fetch + diff table in existing drawer
[22] Add "Entity History" quick-link from User/Timesheet detail pages (optional)
```

---

## 11. Codebase-Specific Implementation Notes

1. **`AuditService.WriteAsync` does NOT call `SaveChangesAsync`** — the interceptor is consistent
   with this pattern; it adds rows to the context and relies on the caller's `SaveChangesAsync`.

2. **EF InMemory in tests** — `ISaveChangesInterceptor` works with the InMemory provider.
   Do NOT use `defaultValueSql: "NEWSEQUENTIALID()"` in entity constructors — set
   `Id = Guid.NewGuid()` instead. (The SQL default is migration-only.)

3. **Designer.cs is mandatory** — every migration needs both `.cs` and `.Designer.cs`.

4. **CorrelationIdMiddleware already exists** at `apps/api/Middleware/CorrelationIdMiddleware.cs`.
   Wire `ICorrelationIdAccessor` to read from `IHttpContextAccessor` using the same header key.

5. **Do NOT include `AuditLog` or `AuditLogChange` in `TrackedTypes`** — would cause
   infinite recursion in the interceptor.

6. **`TrackedTypes` whitelist reduces noise by ~60%** — excludes `RefreshTokens`,
   `PushSubscriptions`, `Notifications`, `ConsentLogs`, etc. which generate high-volume,
   low-value audit rows.

---

## 12. Trade-off Summary

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Field storage | Normalized `AuditLogChanges` rows | JSON column | Queryable by field name; index-seekable |
| Capture mechanism | `ISaveChangesInterceptor` | Domain Events | Catches ALL saves; Domain Events require explicit raising per command |
| Interceptor scope | Opt-in `TrackedTypes` whitelist | All entities | Avoids high-volume noise from infra entities |
| Transaction boundary | Same-transaction (atomic) | Fire-and-forget queue | Compliance: if data change rolls back, audit must too. Queue reserved for background jobs |
| Sensitive field masking | Compile-time `[Sensitive]` attribute | Runtime config file | Attribute travels with property; no config drift; cached via reflection |
| Old `Details` field | Preserved (nullable) | Remove | Backward compat — existing rows have string Details; frontend drawer still reads it |
| Diff rendering | Strikethrough red / green | Unified diff | Simpler for scalar fields; unified diff suited for multiline text (not applicable here) |

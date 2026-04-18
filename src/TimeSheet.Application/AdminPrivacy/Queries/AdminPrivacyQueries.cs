using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.AdminPrivacy.Queries;

public record GetRetentionPolicyQuery : IRequest<Result<RetentionPolicyResult>>;

public record UpdateRetentionPolicyCommand(IReadOnlyCollection<RetentionPolicyItemResult> Items)
    : IRequest<Result<RetentionPolicyResult>>;

public record GetAuditLogsQuery(
    string? Search,
    Guid? ActorId,
    string? Action,
    string? EntityType,
    DateTime? FromDate,
    DateTime? ToDate,
    string? SortOrder,
    int Page,
    int PageSize) : IRequest<Result<AuditLogPageResult>>;

public record GetAuditChangesQuery(Guid AuditLogId) : IRequest<Result<IReadOnlyList<AuditChangeResult>>>;

public record GetEntityAuditHistoryQuery(string EntityType, string EntityId, int Page, int PageSize)
    : IRequest<Result<IReadOnlyList<AuditLogEntryResult>>>;

public record GetAuditLogStatsQuery : IRequest<Result<AuditLogStatsResult>>;

public record GetAuditActorsQuery : IRequest<Result<IReadOnlyList<AuditActorResult>>>;

public record ExportAuditLogsQuery(
    string? Search,
    Guid? ActorId,
    string? Action,
    string? EntityType,
    DateTime? FromDate,
    DateTime? ToDate) : IRequest<Result<AuditExportResult>>;

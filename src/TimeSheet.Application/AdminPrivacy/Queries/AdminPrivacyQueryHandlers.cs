using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.AdminPrivacy.Queries;

public class GetRetentionPolicyQueryHandler(IAdminPrivacyQueryService service)
    : IRequestHandler<GetRetentionPolicyQuery, Result<RetentionPolicyResult>>
{
    public async Task<Result<RetentionPolicyResult>> Handle(GetRetentionPolicyQuery request, CancellationToken cancellationToken)
        => Result<RetentionPolicyResult>.Success(await service.GetRetentionPolicyAsync(cancellationToken));
}

public class UpdateRetentionPolicyCommandHandler(IAdminPrivacyQueryService service)
    : IRequestHandler<UpdateRetentionPolicyCommand, Result<RetentionPolicyResult>>
{
    public async Task<Result<RetentionPolicyResult>> Handle(UpdateRetentionPolicyCommand request, CancellationToken cancellationToken)
        => Result<RetentionPolicyResult>.Success(await service.UpdateRetentionPolicyAsync(request.Items, cancellationToken));
}

public class GetAuditLogsQueryHandler(IAdminPrivacyQueryService service)
    : IRequestHandler<GetAuditLogsQuery, Result<AuditLogPageResult>>
{
    public async Task<Result<AuditLogPageResult>> Handle(GetAuditLogsQuery request, CancellationToken cancellationToken)
        => Result<AuditLogPageResult>.Success(await service.GetAuditLogsAsync(
            new AuditLogFilterResult(
                request.Search,
                request.ActorId,
                request.Action,
                request.EntityType,
                request.FromDate,
                request.ToDate,
                request.SortOrder,
                request.Page,
                request.PageSize),
            cancellationToken));
}

public class GetAuditChangesQueryHandler(IAdminPrivacyQueryService service)
    : IRequestHandler<GetAuditChangesQuery, Result<IReadOnlyList<AuditChangeResult>>>
{
    public async Task<Result<IReadOnlyList<AuditChangeResult>>> Handle(GetAuditChangesQuery request, CancellationToken cancellationToken)
    {
        var result = await service.GetAuditChangesAsync(request.AuditLogId, cancellationToken);
        return result is null
            ? Result<IReadOnlyList<AuditChangeResult>>.NotFound("Audit changes not found.")
            : Result<IReadOnlyList<AuditChangeResult>>.Success(result);
    }
}

public class GetEntityAuditHistoryQueryHandler(IAdminPrivacyQueryService service)
    : IRequestHandler<GetEntityAuditHistoryQuery, Result<IReadOnlyList<AuditLogEntryResult>>>
{
    public async Task<Result<IReadOnlyList<AuditLogEntryResult>>> Handle(GetEntityAuditHistoryQuery request, CancellationToken cancellationToken)
        => Result<IReadOnlyList<AuditLogEntryResult>>.Success(
            await service.GetEntityHistoryAsync(request.EntityType, request.EntityId, request.Page, request.PageSize, cancellationToken));
}

public class GetAuditLogStatsQueryHandler(IAdminPrivacyQueryService service)
    : IRequestHandler<GetAuditLogStatsQuery, Result<AuditLogStatsResult>>
{
    public async Task<Result<AuditLogStatsResult>> Handle(GetAuditLogStatsQuery request, CancellationToken cancellationToken)
        => Result<AuditLogStatsResult>.Success(await service.GetAuditLogStatsAsync(cancellationToken));
}

public class GetAuditActorsQueryHandler(IAdminPrivacyQueryService service)
    : IRequestHandler<GetAuditActorsQuery, Result<IReadOnlyList<AuditActorResult>>>
{
    public async Task<Result<IReadOnlyList<AuditActorResult>>> Handle(GetAuditActorsQuery request, CancellationToken cancellationToken)
        => Result<IReadOnlyList<AuditActorResult>>.Success(await service.GetAuditActorsAsync(cancellationToken));
}

public class ExportAuditLogsQueryHandler(IAdminPrivacyQueryService service)
    : IRequestHandler<ExportAuditLogsQuery, Result<AuditExportResult>>
{
    public async Task<Result<AuditExportResult>> Handle(ExportAuditLogsQuery request, CancellationToken cancellationToken)
        => Result<AuditExportResult>.Success(await service.ExportAuditLogsAsync(
            new AuditLogFilterResult(
                request.Search,
                request.ActorId,
                request.Action,
                request.EntityType,
                request.FromDate,
                request.ToDate,
                null,
                1,
                500),
            cancellationToken));
}

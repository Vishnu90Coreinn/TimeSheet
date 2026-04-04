using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Tenant.Commands;

public record UpdateTenantSettingsCommand(
    string? AppName,
    string? PrimaryColor,
    string? CustomDomain,
    TenantAssetUpload? Logo,
    TenantAssetUpload? Favicon) : IRequest<Result<TenantSettingsResult>>;

public record RemoveTenantLogoCommand : IRequest<Result>;
public record RemoveTenantFaviconCommand : IRequest<Result>;

using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Tenant.Commands;

public class UpdateTenantSettingsCommandHandler(ITenantSettingsService tenantSettingsService)
    : IRequestHandler<UpdateTenantSettingsCommand, Result<TenantSettingsResult>>
{
    public async Task<Result<TenantSettingsResult>> Handle(UpdateTenantSettingsCommand request, CancellationToken cancellationToken)
        => Result<TenantSettingsResult>.Success(await tenantSettingsService.UpdateAsync(
            request.AppName,
            request.PrimaryColor,
            request.CustomDomain,
            request.Logo,
            request.Favicon,
            cancellationToken));
}

public class RemoveTenantLogoCommandHandler(ITenantSettingsService tenantSettingsService) : IRequestHandler<RemoveTenantLogoCommand, Result>
{
    public async Task<Result> Handle(RemoveTenantLogoCommand request, CancellationToken cancellationToken)
    {
        await tenantSettingsService.RemoveLogoAsync(cancellationToken);
        return Result.Success();
    }
}

public class RemoveTenantFaviconCommandHandler(ITenantSettingsService tenantSettingsService) : IRequestHandler<RemoveTenantFaviconCommand, Result>
{
    public async Task<Result> Handle(RemoveTenantFaviconCommand request, CancellationToken cancellationToken)
    {
        await tenantSettingsService.RemoveFaviconAsync(cancellationToken);
        return Result.Success();
    }
}

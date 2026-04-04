using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Tenant.Queries;

public class GetTenantSettingsQueryHandler(ITenantSettingsService tenantSettingsService)
    : IRequestHandler<GetTenantSettingsQuery, Result<TenantSettingsResult>>
{
    public async Task<Result<TenantSettingsResult>> Handle(GetTenantSettingsQuery request, CancellationToken cancellationToken)
        => Result<TenantSettingsResult>.Success(await tenantSettingsService.GetAsync(cancellationToken));
}

using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Application.Tenant.Queries;

public record GetTenantSettingsQuery : IRequest<Result<TenantSettingsResult>>;

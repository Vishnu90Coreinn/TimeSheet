using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Roles.Models;
using TimeSheet.Api.Application.Roles.Services;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.Roles.Handlers;

public interface IGetRolesHandler
{
    Task<(PagedResult<RoleResponse>? Data, OperationError? Error)> HandleAsync(RoleListQuery query, CancellationToken cancellationToken);
}

public class GetRolesHandler(IRoleService roleService) : IGetRolesHandler
{
    public Task<(PagedResult<RoleResponse>? Data, OperationError? Error)> HandleAsync(RoleListQuery query, CancellationToken cancellationToken)
        => roleService.GetRolesAsync(query, cancellationToken);
}

public interface ICreateRoleHandler
{
    Task<(RoleResponse? Data, OperationError? Error)> HandleAsync(AssignRoleRequest request, CancellationToken cancellationToken);
}

public class CreateRoleHandler(IRoleService roleService) : ICreateRoleHandler
{
    public Task<(RoleResponse? Data, OperationError? Error)> HandleAsync(AssignRoleRequest request, CancellationToken cancellationToken)
        => roleService.CreateRoleAsync(request, cancellationToken);
}

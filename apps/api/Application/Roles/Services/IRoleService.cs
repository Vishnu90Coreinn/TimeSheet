using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Roles.Models;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.Roles.Services;

public interface IRoleService
{
    Task<(PagedResult<RoleResponse>? Data, OperationError? Error)> GetRolesAsync(RoleListQuery query, CancellationToken cancellationToken);
    Task<(RoleResponse? Data, OperationError? Error)> CreateRoleAsync(AssignRoleRequest request, CancellationToken cancellationToken);
}

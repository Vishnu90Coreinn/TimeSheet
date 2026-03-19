using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Roles.Models;
using TimeSheet.Api.Application.Roles.Validators;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.Roles;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Application.Roles.Services;

public class RoleService(IRoleRepository roleRepository, IRoleListQueryValidator listValidator, IRoleCreateValidator createValidator) : IRoleService
{
    public async Task<(PagedResult<RoleResponse>? Data, OperationError? Error)> GetRolesAsync(RoleListQuery query, CancellationToken cancellationToken)
    {
        var error = listValidator.Validate(query);
        if (error is not null)
        {
            return (null, error);
        }

        var roles = await roleRepository.GetRolesAsync(query, cancellationToken);
        return (roles, null);
    }

    public async Task<(RoleResponse? Data, OperationError? Error)> CreateRoleAsync(AssignRoleRequest request, CancellationToken cancellationToken)
    {
        var error = createValidator.Validate(request);
        if (error is not null)
        {
            return (null, error);
        }

        var roleName = request.RoleName.Trim();
        if (await roleRepository.RoleExistsAsync(roleName, cancellationToken))
        {
            return (null, new OperationError(ErrorCodes.RoleAlreadyExists, ApiMessages.RoleAlreadyExists, StatusCodes.Status409Conflict));
        }

        var role = new Role { Id = Guid.NewGuid(), Name = roleName };
        roleRepository.AddRole(role);
        await roleRepository.SaveChangesAsync(cancellationToken);
        return (new RoleResponse(role.Id, role.Name), null);
    }
}

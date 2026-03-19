using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Roles.Models;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Infrastructure.Persistence.Repositories.Roles;

public interface IRoleRepository
{
    Task<PagedResult<RoleResponse>> GetRolesAsync(RoleListQuery query, CancellationToken cancellationToken);
    Task<bool> RoleExistsAsync(string roleName, CancellationToken cancellationToken);
    void AddRole(Role role);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

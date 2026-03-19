using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Roles.Models;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Infrastructure.Persistence.Repositories.Roles;

public class RoleRepository(TimeSheetDbContext dbContext) : IRoleRepository
{
    public async Task<PagedResult<RoleResponse>> GetRolesAsync(RoleListQuery query, CancellationToken cancellationToken)
    {
        var roles = dbContext.Roles.AsNoTracking();

        if (!query.FetchAll && !string.IsNullOrWhiteSpace(query.Name))
        {
            roles = roles.Where(r => r.Name.Contains(query.Name.Trim()));
        }

        var isAscending = string.Equals(query.SortDirection, "asc", StringComparison.OrdinalIgnoreCase);
        roles = isAscending ? roles.OrderBy(r => r.Name) : roles.OrderByDescending(r => r.Name);

        var totalCount = await roles.CountAsync(cancellationToken);

        if (!query.FetchAll)
        {
            roles = roles.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize);
        }

        var items = await roles.Select(r => new RoleResponse(r.Id, r.Name)).ToListAsync(cancellationToken);
        return new PagedResult<RoleResponse>(items, totalCount, query.FetchAll ? 1 : query.PageNumber, query.FetchAll ? totalCount : query.PageSize, query.FetchAll);
    }

    public Task<bool> RoleExistsAsync(string roleName, CancellationToken cancellationToken)
        => dbContext.Roles.AnyAsync(r => r.Name == roleName, cancellationToken);

    public void AddRole(Role role) => dbContext.Roles.Add(role);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => dbContext.SaveChangesAsync(cancellationToken);
}

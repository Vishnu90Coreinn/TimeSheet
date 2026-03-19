using TimeSheet.Api.Application.Roles.Models;
using TimeSheet.Api.Application.Roles.Services;
using TimeSheet.Api.Application.Roles.Validators;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.Roles;
using TimeSheet.Api.Models;
using Xunit;

namespace TimeSheet.Api.Tests;

public class RoleServiceTests
{
    [Fact]
    public async Task CreateRole_ReturnsConflict_WhenRoleExists()
    {
        var repository = new FakeRoleRepository { Exists = true };
        var service = new RoleService(repository, new RoleListQueryValidator(), new RoleCreateValidator());

        var (data, error) = await service.CreateRoleAsync(new AssignRoleRequest("admin"), CancellationToken.None);

        Assert.Null(data);
        Assert.NotNull(error);
        Assert.Equal(409, error!.StatusCode);
    }

    private sealed class FakeRoleRepository : IRoleRepository
    {
        public bool Exists { get; set; }

        public Task<TimeSheet.Api.Application.Common.Models.PagedResult<RoleResponse>> GetRolesAsync(RoleListQuery query, CancellationToken cancellationToken)
            => throw new NotImplementedException();

        public Task<bool> RoleExistsAsync(string roleName, CancellationToken cancellationToken) => Task.FromResult(Exists);

        public void AddRole(Role role)
        {
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}

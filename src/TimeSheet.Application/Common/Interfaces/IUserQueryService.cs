using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Users.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface IUserQueryService
{
    Task<PagedResult<UserListItemResult>> GetUsersPageAsync(
        string? search,
        string? role,
        Guid? departmentId,
        bool? isActive,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);
}

using TimeSheet.Api.Application.Common.Models;

namespace TimeSheet.Api.Application.Roles.Models;

public class RoleListQuery : ListQuery
{
    public string? Name { get; init; }
}

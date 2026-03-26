using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Queries;

public class GetRolesQueryHandler(IRoleRepository roleRepository)
    : IRequestHandler<GetRolesQuery, Result<List<RoleResult>>>
{
    public async Task<Result<List<RoleResult>>> Handle(GetRolesQuery request, CancellationToken cancellationToken)
    {
        var roles = await roleRepository.GetAllAsync(cancellationToken);
        var result = roles
            .OrderBy(r => r.Name)
            .Select(r => new RoleResult(r.Id, r.Name))
            .ToList();
        return Result<List<RoleResult>>.Success(result);
    }
}

using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Commands;

public class CreateRoleCommandHandler(IRoleRepository roleRepository, IUnitOfWork unitOfWork)
    : IRequestHandler<CreateRoleCommand, Result<RoleCreatedResult>>
{
    public async Task<Result<RoleCreatedResult>> Handle(CreateRoleCommand request, CancellationToken cancellationToken)
    {
        if (await roleRepository.ExistsAsync(request.RoleName, cancellationToken))
            return Result<RoleCreatedResult>.Conflict("Role already exists.");

        var role = new Role { Id = Guid.NewGuid(), Name = request.RoleName.Trim() };
        roleRepository.Add(role);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<RoleCreatedResult>.Success(new RoleCreatedResult(role.Id, role.Name));
    }
}

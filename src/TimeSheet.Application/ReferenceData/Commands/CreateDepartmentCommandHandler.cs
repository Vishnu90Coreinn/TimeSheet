using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Commands;

public class CreateDepartmentCommandHandler(IDepartmentRepository departmentRepository, IUnitOfWork unitOfWork)
    : IRequestHandler<CreateDepartmentCommand, Result<DepartmentMutationResult>>
{
    public async Task<Result<DepartmentMutationResult>> Handle(CreateDepartmentCommand request, CancellationToken cancellationToken)
    {
        if (await departmentRepository.ExistsAsync(request.Name, cancellationToken))
            return Result<DepartmentMutationResult>.Conflict("Department already exists.");

        var department = new Department { Id = Guid.NewGuid(), Name = request.Name.Trim(), IsActive = request.IsActive };
        departmentRepository.Add(department);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DepartmentMutationResult>.Success(new DepartmentMutationResult(department.Id, department.Name, department.IsActive));
    }
}

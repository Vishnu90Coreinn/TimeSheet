using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Queries;

public class GetDepartmentsQueryHandler(IDepartmentRepository departmentRepository)
    : IRequestHandler<GetDepartmentsQuery, Result<List<DepartmentResult>>>
{
    public async Task<Result<List<DepartmentResult>>> Handle(GetDepartmentsQuery request, CancellationToken cancellationToken)
    {
        var departments = await departmentRepository.GetAllAsync(cancellationToken);
        var result = departments
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentResult(d.Id, d.Name, d.IsActive))
            .ToList();
        return Result<List<DepartmentResult>>.Success(result);
    }
}

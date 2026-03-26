using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Queries;

public record GetDepartmentsQuery : IRequest<Result<List<DepartmentResult>>>;

public record DepartmentResult(Guid Id, string Name, bool IsActive);

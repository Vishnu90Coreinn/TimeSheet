using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Commands;

public record CreateDepartmentCommand(string Name, bool IsActive) : IRequest<Result<DepartmentMutationResult>>;

public record DepartmentMutationResult(Guid Id, string Name, bool IsActive);

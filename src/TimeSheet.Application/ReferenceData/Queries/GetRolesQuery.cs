using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Queries;

public record GetRolesQuery : IRequest<Result<List<RoleResult>>>;

public record RoleResult(Guid Id, string Name);

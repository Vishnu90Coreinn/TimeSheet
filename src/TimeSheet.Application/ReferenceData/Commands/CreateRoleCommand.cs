using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Commands;

public record CreateRoleCommand(string RoleName) : IRequest<Result<RoleCreatedResult>>;

public record RoleCreatedResult(Guid Id, string Name);

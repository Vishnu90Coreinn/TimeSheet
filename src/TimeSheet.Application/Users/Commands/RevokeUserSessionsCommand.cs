using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Users.Commands;

public record RevokeUserSessionsCommand(Guid TargetUserId) : IRequest<Result>;

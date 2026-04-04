using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Users.Commands;

public record AdminResetPasswordCommand(Guid TargetUserId) : IRequest<Result<string>>;

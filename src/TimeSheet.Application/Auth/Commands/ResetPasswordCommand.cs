using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Auth.Commands;

public record ResetPasswordCommand(string Token, string NewPassword) : IRequest<Result>;

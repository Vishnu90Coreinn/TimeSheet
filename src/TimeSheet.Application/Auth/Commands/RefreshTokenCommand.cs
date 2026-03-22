using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Auth.Commands;

public record RefreshTokenCommand(string RefreshToken) : IRequest<Result<LoginResult>>;

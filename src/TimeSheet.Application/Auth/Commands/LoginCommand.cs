using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Auth.Commands;

public record LoginCommand(string Identifier, string Password) : IRequest<Result<LoginResult>>;

public record LoginResult(string AccessToken, string RefreshToken, Guid UserId, string Username, string Email, string Role);

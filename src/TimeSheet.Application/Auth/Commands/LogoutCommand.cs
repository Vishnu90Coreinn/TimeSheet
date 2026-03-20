using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Auth.Commands;

public record LogoutCommand(string RefreshToken) : IRequest<Result>;

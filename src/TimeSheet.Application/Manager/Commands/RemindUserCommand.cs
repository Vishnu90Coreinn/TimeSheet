using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Manager.Commands;

public record RemindUserCommand(Guid UserId) : IRequest<Result>;

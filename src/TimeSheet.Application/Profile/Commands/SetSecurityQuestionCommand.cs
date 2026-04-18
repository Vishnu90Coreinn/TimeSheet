using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Profile.Commands;

public record SetSecurityQuestionCommand(
    Guid UserId,
    string Question,
    string Answer,
    string CurrentPassword) : IRequest<Result>;

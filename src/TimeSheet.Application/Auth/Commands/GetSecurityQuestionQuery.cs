using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Auth.Commands;

public record GetSecurityQuestionQuery(string Username) : IRequest<Result<string>>;

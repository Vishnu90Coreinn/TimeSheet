using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Profile.Queries;

public record GetSecurityQuestionStatusQuery(Guid UserId) : IRequest<Result<SecurityQuestionStatusResult>>;

public record SecurityQuestionStatusResult(bool HasQuestion, string? Question);

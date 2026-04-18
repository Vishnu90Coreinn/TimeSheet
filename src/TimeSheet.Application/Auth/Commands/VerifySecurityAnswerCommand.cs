using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Auth.Commands;

public record VerifySecurityAnswerCommand(string Username, string Answer) : IRequest<Result<VerifySecurityAnswerResult>>;

public record VerifySecurityAnswerResult(string ResetToken, DateTime ExpiresAtUtc);

using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.PasswordPolicy.Queries;

public record GetPasswordPolicyQuery : IRequest<Result<PasswordPolicyResult>>;

public record PasswordPolicyResult(
    int MinLength,
    bool RequireUppercase,
    bool RequireLowercase,
    bool RequireNumber,
    bool RequireSpecialChar,
    int MaxAgeDays);

using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.PasswordPolicy.Commands;

public record UpdatePasswordPolicyCommand(
    int MinLength,
    bool RequireUppercase,
    bool RequireLowercase,
    bool RequireNumber,
    bool RequireSpecialChar,
    int MaxAgeDays) : IRequest<Result>;

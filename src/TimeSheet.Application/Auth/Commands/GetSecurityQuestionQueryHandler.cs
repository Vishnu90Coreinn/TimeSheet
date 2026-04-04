using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Auth.Commands;

public class GetSecurityQuestionQueryHandler(IUserRepository userRepo)
    : IRequestHandler<GetSecurityQuestionQuery, Result<string>>
{
    public async Task<Result<string>> Handle(GetSecurityQuestionQuery request, CancellationToken cancellationToken)
    {
        var identifier = request.Username?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(identifier))
            return Result<string>.NotFound("Security question not found.");

        var user = await userRepo.GetByUsernameOrEmailAsync(identifier, cancellationToken);

        if (user is null || string.IsNullOrWhiteSpace(user.SecurityQuestion))
            return Result<string>.NotFound("Security question not found.");

        return Result<string>.Success(user.SecurityQuestion);
    }
}

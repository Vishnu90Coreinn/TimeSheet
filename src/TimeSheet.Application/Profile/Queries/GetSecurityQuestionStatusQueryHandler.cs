using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Profile.Queries;

public class GetSecurityQuestionStatusQueryHandler(IUserRepository userRepo)
    : IRequestHandler<GetSecurityQuestionStatusQuery, Result<SecurityQuestionStatusResult>>
{
    public async Task<Result<SecurityQuestionStatusResult>> Handle(GetSecurityQuestionStatusQuery request, CancellationToken cancellationToken)
    {
        var user = await userRepo.GetByIdAsync(request.UserId, cancellationToken);
        if (user is null)
            return Result<SecurityQuestionStatusResult>.NotFound("User not found.");

        var hasQuestion = !string.IsNullOrWhiteSpace(user.SecurityQuestion);
        return Result<SecurityQuestionStatusResult>.Success(
            new SecurityQuestionStatusResult(hasQuestion, hasQuestion ? user.SecurityQuestion : null));
    }
}

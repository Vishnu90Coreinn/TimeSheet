using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Onboarding.Queries;

public class GetOnboardingChecklistQueryHandler(
    IUserRepository userRepository,
    ICurrentUserService currentUser,
    IOnboardingQueryService onboardingQueryService)
    : IRequestHandler<GetOnboardingChecklistQuery, Result<OnboardingChecklistResult>>
{
    public async Task<Result<OnboardingChecklistResult>> Handle(GetOnboardingChecklistQuery request, CancellationToken cancellationToken)
    {
        var user = await userRepository.GetByIdAsync(currentUser.UserId, cancellationToken);
        if (user is null)
            return Result<OnboardingChecklistResult>.NotFound("User not found.");

        var checklist = await onboardingQueryService.GetChecklistAsync(user.Id, currentUser.Role, cancellationToken);
        return Result<OnboardingChecklistResult>.Success(checklist);
    }
}

using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Onboarding.Commands;

public class CompleteOnboardingCommandHandler(
    IUserRepository userRepository,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider,
    IUnitOfWork unitOfWork)
    : IRequestHandler<CompleteOnboardingCommand, Result>
{
    public async Task<Result> Handle(CompleteOnboardingCommand request, CancellationToken cancellationToken)
    {
        var user = await userRepository.GetByIdAsync(currentUser.UserId, cancellationToken);
        if (user is null)
            return Result.NotFound("User not found.");

        if (!user.OnboardingCompletedAt.HasValue)
        {
            user.OnboardingCompletedAt = dateTimeProvider.UtcNow;
            userRepository.Update(user);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

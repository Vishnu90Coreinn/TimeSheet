using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Onboarding.Commands;

public class MarkLeaveWorkflowVisitedCommandHandler(
    IUserRepository userRepository,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider,
    IUnitOfWork unitOfWork)
    : IRequestHandler<MarkLeaveWorkflowVisitedCommand, Result>
{
    public async Task<Result> Handle(MarkLeaveWorkflowVisitedCommand request, CancellationToken cancellationToken)
    {
        var user = await userRepository.GetByIdAsync(currentUser.UserId, cancellationToken);
        if (user is null)
            return Result.NotFound("User not found.");

        if (!user.LeaveWorkflowVisitedAt.HasValue)
        {
            user.LeaveWorkflowVisitedAt = dateTimeProvider.UtcNow;
            userRepository.Update(user);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

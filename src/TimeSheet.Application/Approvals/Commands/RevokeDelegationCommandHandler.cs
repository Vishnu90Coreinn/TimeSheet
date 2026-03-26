using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Approvals.Commands;

public class RevokeDelegationCommandHandler(
    IApprovalDelegationRepository repo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser)
    : IRequestHandler<RevokeDelegationCommand, Result>
{
    public async Task<Result> Handle(RevokeDelegationCommand request, CancellationToken cancellationToken)
    {
        var delegation = await repo.GetByIdAsync(request.DelegationId, cancellationToken);
        if (delegation is null)
            return Result.NotFound("Delegation not found.");

        if (delegation.FromUserId != currentUser.UserId && !currentUser.IsAdmin)
            return Result.Forbidden("You can only revoke your own delegations.");

        delegation.IsActive = false;
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

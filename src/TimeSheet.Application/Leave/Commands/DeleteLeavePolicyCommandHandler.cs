using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Leave.Commands;

public class DeleteLeavePolicyCommandHandler(
    ILeavePolicyRepository leavePolicyRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser)
    : IRequestHandler<DeleteLeavePolicyCommand, Result>
{
    public async Task<Result> Handle(DeleteLeavePolicyCommand request, CancellationToken ct)
    {
        if (!currentUser.IsAdmin)
            return Result.Forbidden("Admin only.");

        var policy = await leavePolicyRepo.GetByIdAsync(request.Id, ct);
        if (policy is null)
            return Result.NotFound($"LeavePolicy '{request.Id}' not found.");

        leavePolicyRepo.Remove(policy);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }
}

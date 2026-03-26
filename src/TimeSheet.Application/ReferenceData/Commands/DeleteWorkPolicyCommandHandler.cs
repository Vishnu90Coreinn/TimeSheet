using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Commands;

public class DeleteWorkPolicyCommandHandler(IWorkPolicyRepository workPolicyRepository, IUnitOfWork unitOfWork)
    : IRequestHandler<DeleteWorkPolicyCommand, Result>
{
    public async Task<Result> Handle(DeleteWorkPolicyCommand request, CancellationToken cancellationToken)
    {
        var policy = await workPolicyRepository.GetByIdAsync(request.Id, cancellationToken);
        if (policy is null) return Result.NotFound("Work policy not found.");

        workPolicyRepository.Remove(policy);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

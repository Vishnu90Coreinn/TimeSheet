using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Leave.Commands;

public class UpdateLeavePolicyCommandHandler(
    ILeavePolicyRepository leavePolicyRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser)
    : IRequestHandler<UpdateLeavePolicyCommand, Result>
{
    public async Task<Result> Handle(UpdateLeavePolicyCommand request, CancellationToken ct)
    {
        if (!currentUser.IsAdmin)
            return Result.Forbidden("Admin only.");

        var name = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name))
            return Result.ValidationFailure("Name is required.");

        var policy = await leavePolicyRepo.GetByIdWithAllocationsAsync(request.Id, ct);
        if (policy is null)
            return Result.NotFound($"LeavePolicy '{request.Id}' not found.");

        policy.Name = name;
        policy.IsActive = request.IsActive;

        // Replace allocations
        leavePolicyRepo.RemoveAllocations(policy.Allocations);
        policy.Allocations = request.Allocations.Select(a => new LeavePolicyAllocation
        {
            Id = Guid.NewGuid(),
            LeavePolicyId = policy.Id,
            LeaveTypeId = a.LeaveTypeId,
            DaysPerYear = a.DaysPerYear
        }).ToList();

        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }
}

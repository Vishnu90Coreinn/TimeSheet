using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Leave.Commands;

public class CreateLeavePolicyCommandHandler(
    ILeavePolicyRepository leavePolicyRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser)
    : IRequestHandler<CreateLeavePolicyCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateLeavePolicyCommand request, CancellationToken ct)
    {
        if (!currentUser.IsAdmin)
            return Result<Guid>.Forbidden("Admin only.");

        var name = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name))
            return Result<Guid>.ValidationFailure("Name is required.");

        var policy = new LeavePolicy
        {
            Id = Guid.NewGuid(),
            Name = name,
            IsActive = request.IsActive,
            CreatedAtUtc = DateTime.UtcNow
        };

        policy.Allocations = request.Allocations.Select(a => new LeavePolicyAllocation
        {
            Id = Guid.NewGuid(),
            LeavePolicyId = policy.Id,
            LeaveTypeId = a.LeaveTypeId,
            DaysPerYear = a.DaysPerYear
        }).ToList();

        leavePolicyRepo.Add(policy);
        await unitOfWork.SaveChangesAsync(ct);

        return Result<Guid>.Success(policy.Id);
    }
}

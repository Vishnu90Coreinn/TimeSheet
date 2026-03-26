using MediatR;
using TimeSheet.Application.Approvals.Queries;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Approvals.Commands;

public class CreateDelegationCommandHandler(
    IApprovalDelegationRepository repo,
    IUserRepository userRepository,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider)
    : IRequestHandler<CreateDelegationCommand, Result<DelegationDto>>
{
    public async Task<Result<DelegationDto>> Handle(CreateDelegationCommand request, CancellationToken cancellationToken)
    {
        if (request.FromDate > request.ToDate)
            return Result<DelegationDto>.ValidationFailure("From date must be before or equal to to date.");

        var toUser = await userRepository.GetByIdAsync(request.ToUserId, cancellationToken);
        if (toUser is null)
            return Result<DelegationDto>.NotFound("Delegate user not found.");

        if (toUser.Role != "manager" && toUser.Role != "admin")
            return Result<DelegationDto>.ValidationFailure("Delegate must be a manager or admin.");

        var hasOverlap = await repo.HasOverlapAsync(currentUser.UserId, request.FromDate, request.ToDate, cancellationToken);
        if (hasOverlap)
            return Result<DelegationDto>.Conflict("An active delegation already exists for this date range.");

        var delegation = new ApprovalDelegation
        {
            FromUserId = currentUser.UserId,
            ToUserId = request.ToUserId,
            FromDate = request.FromDate,
            ToDate = request.ToDate,
            IsActive = true,
            CreatedAtUtc = dateTimeProvider.UtcNow
        };

        repo.Add(delegation);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DelegationDto>.Success(new DelegationDto(
            delegation.Id,
            delegation.FromUserId,
            currentUser.Username,
            delegation.ToUserId,
            toUser.Username,
            delegation.FromDate,
            delegation.ToDate,
            delegation.IsActive,
            delegation.CreatedAtUtc));
    }
}

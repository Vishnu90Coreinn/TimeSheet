using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Approvals.Queries;

public class GetDelegationQueryHandler(
    IApprovalDelegationRepository repo,
    ICurrentUserService currentUser)
    : IRequestHandler<GetDelegationQuery, Result<DelegationDto?>>
{
    public async Task<Result<DelegationDto?>> Handle(GetDelegationQuery request, CancellationToken cancellationToken)
    {
        var delegation = await repo.GetActiveForUserAsync(currentUser.UserId, cancellationToken);
        if (delegation is null)
            return Result<DelegationDto?>.Success(null);

        return Result<DelegationDto?>.Success(new DelegationDto(
            delegation.Id,
            delegation.FromUserId,
            delegation.FromUser.Username,
            delegation.ToUserId,
            delegation.ToUser.Username,
            delegation.FromDate,
            delegation.ToDate,
            delegation.IsActive,
            delegation.CreatedAtUtc));
    }
}

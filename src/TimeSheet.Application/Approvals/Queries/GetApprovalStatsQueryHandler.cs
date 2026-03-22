using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Queries;

public class GetApprovalStatsQueryHandler(
    IApprovalQueryService approvalQuery,
    ICurrentUserService currentUser)
    : IRequestHandler<GetApprovalStatsQuery, Result<ApprovalStatsResult>>
{
    public async Task<Result<ApprovalStatsResult>> Handle(
        GetApprovalStatsQuery request, CancellationToken ct)
    {
        var stats = await approvalQuery.GetStatsAsync(currentUser.UserId, ct);
        return Result<ApprovalStatsResult>.Success(stats);
    }
}

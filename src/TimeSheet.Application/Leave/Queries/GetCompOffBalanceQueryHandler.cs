using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public class GetCompOffBalanceQueryHandler(
    ICompOffBalanceService compOffBalanceService,
    ICurrentUserService currentUserService)
    : IRequestHandler<GetCompOffBalanceQuery, Result<CompOffBalanceResult>>
{
    public async Task<Result<CompOffBalanceResult>> Handle(GetCompOffBalanceQuery request, CancellationToken cancellationToken)
    {
        var (credits, nextExpiry) = await compOffBalanceService.GetActiveBalanceAsync(currentUserService.UserId, cancellationToken);

        return Result<CompOffBalanceResult>.Success(new CompOffBalanceResult(
            Credits: Math.Round(credits, 2, MidpointRounding.AwayFromZero),
            Hours: Math.Round(credits, 2, MidpointRounding.AwayFromZero),
            NextExpiryAtUtc: nextExpiry));
    }
}

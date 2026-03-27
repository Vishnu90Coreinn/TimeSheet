using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Queries;

public class GetApprovalStatsQueryHandler(
    IApprovalQueryService approvalQuery,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider)
    : IRequestHandler<GetApprovalStatsQuery, Result<ApprovalStatsResult>>
{
    public async Task<Result<ApprovalStatsResult>> Handle(
        GetApprovalStatsQuery request, CancellationToken ct)
    {
        var now = dateTimeProvider.UtcNow;
        var (fromUtc, toUtc) = ResolvePeriod(request, now);
        if (toUtc <= fromUtc)
            return Result<ApprovalStatsResult>.ValidationFailure("Invalid period. 'to' must be after 'from'.");

        var stats = await approvalQuery.GetStatsAsync(currentUser.UserId, fromUtc, toUtc, ct);
        return Result<ApprovalStatsResult>.Success(stats);
    }

    private static (DateTime FromUtc, DateTime ToUtc) ResolvePeriod(GetApprovalStatsQuery request, DateTime nowUtc)
    {
        return request.Period switch
        {
            ApprovalStatsPeriod.ThisWeek => ResolveWeek(nowUtc),
            ApprovalStatsPeriod.Custom => ResolveCustom(request, nowUtc),
            _ => ResolveMonth(nowUtc),
        };
    }

    private static (DateTime FromUtc, DateTime ToUtc) ResolveWeek(DateTime nowUtc)
    {
        var today = DateOnly.FromDateTime(nowUtc);
        var diff = ((int)today.DayOfWeek + 6) % 7; // Monday start
        var monday = today.AddDays(-diff);
        var fromUtc = monday.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        return (fromUtc, fromUtc.AddDays(7));
    }

    private static (DateTime FromUtc, DateTime ToUtc) ResolveMonth(DateTime nowUtc)
    {
        var fromUtc = new DateTime(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        return (fromUtc, fromUtc.AddMonths(1));
    }

    private static (DateTime FromUtc, DateTime ToUtc) ResolveCustom(GetApprovalStatsQuery request, DateTime nowUtc)
    {
        var from = request.FromDate ?? DateOnly.FromDateTime(nowUtc.AddDays(-6));
        var to = request.ToDate ?? DateOnly.FromDateTime(nowUtc);
        var fromUtc = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        return (fromUtc, to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
    }
}

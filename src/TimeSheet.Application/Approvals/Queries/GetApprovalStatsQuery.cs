using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Queries;

public enum ApprovalStatsPeriod
{
    ThisWeek = 0,
    ThisMonth = 1,
    Custom = 2
}

public record GetApprovalStatsQuery(
    ApprovalStatsPeriod Period = ApprovalStatsPeriod.ThisMonth,
    DateOnly? FromDate = null,
    DateOnly? ToDate = null) : IRequest<Result<ApprovalStatsResult>>;

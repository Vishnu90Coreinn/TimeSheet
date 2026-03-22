using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Queries;

public record GetApprovalStatsQuery : IRequest<Result<ApprovalStatsResult>>;

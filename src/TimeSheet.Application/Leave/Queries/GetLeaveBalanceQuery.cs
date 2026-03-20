using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public record GetLeaveBalanceQuery(Guid? TargetUserId = null) : IRequest<Result<List<LeaveBalanceResult>>>;

using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public record GetMyGroupedLeaveQuery : IRequest<Result<List<LeaveGroupResult>>>;

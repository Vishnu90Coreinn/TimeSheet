using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Queries;

public record GetMyLeaveRequestsQuery : IRequest<Result<List<LeaveRequestResult>>>;

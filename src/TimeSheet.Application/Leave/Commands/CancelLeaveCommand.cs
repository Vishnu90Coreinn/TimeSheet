using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Commands;

public record CancelLeaveCommand(Guid LeaveRequestId) : IRequest<Result>;

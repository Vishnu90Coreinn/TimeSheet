using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Commands;

public record ReviewLeaveCommand(Guid LeaveRequestId, bool Approve, string? Comment) : IRequest<Result>;

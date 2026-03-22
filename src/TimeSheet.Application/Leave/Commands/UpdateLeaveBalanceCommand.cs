using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Commands;

public record UpdateLeaveBalanceCommand(
    Guid UserId,
    Guid LeaveTypeId,
    int Adjustment,
    string? Note)
    : IRequest<Result>;

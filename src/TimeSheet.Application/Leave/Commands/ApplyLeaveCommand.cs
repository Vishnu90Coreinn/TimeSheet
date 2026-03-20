using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Commands;

public record ApplyLeaveCommand(
    DateOnly FromDate,
    DateOnly ToDate,
    Guid LeaveTypeId,
    bool IsHalfDay,
    string? Comment) : IRequest<Result<ApplyLeaveResult>>;

public record ApplyLeaveResult(Guid LeaveGroupId, int Count);

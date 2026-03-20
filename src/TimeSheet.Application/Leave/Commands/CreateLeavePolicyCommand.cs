using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Commands;

public record LeavePolicyAllocationDto(Guid LeaveTypeId, int DaysPerYear);

public record CreateLeavePolicyCommand(
    string Name,
    bool IsActive,
    IReadOnlyList<LeavePolicyAllocationDto> Allocations)
    : IRequest<Result<Guid>>;

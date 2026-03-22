using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Commands;

public record UpdateLeavePolicyCommand(
    Guid Id,
    string Name,
    bool IsActive,
    IReadOnlyList<LeavePolicyAllocationDto> Allocations)
    : IRequest<Result>;

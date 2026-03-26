using MediatR;
using TimeSheet.Application.Approvals.Queries;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Commands;

public record CreateDelegationCommand(Guid ToUserId, DateOnly FromDate, DateOnly ToDate)
    : IRequest<Result<DelegationDto>>;

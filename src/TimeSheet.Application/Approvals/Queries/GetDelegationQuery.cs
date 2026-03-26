using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Queries;

public record GetDelegationQuery : IRequest<Result<DelegationDto?>>;

public record DelegationDto(
    Guid Id,
    Guid FromUserId,
    string FromUsername,
    Guid ToUserId,
    string ToUsername,
    DateOnly FromDate,
    DateOnly ToDate,
    bool IsActive,
    DateTime CreatedAtUtc);

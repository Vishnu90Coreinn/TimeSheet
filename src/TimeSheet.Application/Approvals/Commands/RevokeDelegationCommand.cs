using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Commands;

public record RevokeDelegationCommand(Guid DelegationId) : IRequest<Result>;

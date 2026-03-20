using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Commands;

public record DeleteLeavePolicyCommand(Guid Id) : IRequest<Result>;

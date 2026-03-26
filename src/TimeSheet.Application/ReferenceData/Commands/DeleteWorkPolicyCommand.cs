using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Commands;

public record DeleteWorkPolicyCommand(Guid Id) : IRequest<Result>;

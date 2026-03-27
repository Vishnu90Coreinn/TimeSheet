using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Onboarding.Commands;

public record MarkLeaveWorkflowVisitedCommand : IRequest<Result>;

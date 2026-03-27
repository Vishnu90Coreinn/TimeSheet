using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Onboarding.Commands;

public record CompleteOnboardingCommand : IRequest<Result>;

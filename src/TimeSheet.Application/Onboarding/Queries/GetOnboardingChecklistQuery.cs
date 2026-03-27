using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Onboarding.Queries;

public record GetOnboardingChecklistQuery : IRequest<Result<OnboardingChecklistResult>>;

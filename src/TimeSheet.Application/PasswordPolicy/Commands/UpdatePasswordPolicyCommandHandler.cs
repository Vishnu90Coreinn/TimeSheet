using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.PasswordPolicy.Commands;

public class UpdatePasswordPolicyCommandHandler(
    IPasswordPolicyRepository policyRepo,
    ICurrentUserService currentUserService,
    IUnitOfWork unitOfWork)
    : IRequestHandler<UpdatePasswordPolicyCommand, Result>
{
    public async Task<Result> Handle(UpdatePasswordPolicyCommand request, CancellationToken cancellationToken)
    {
        if (!currentUserService.IsAdmin)
            return Result.Forbidden("Only administrators can update the password policy.");

        if (request.MinLength < 4)
            return Result.ValidationFailure("Minimum length must be at least 4.");

        var policy = await policyRepo.GetAsync(cancellationToken) ?? new Domain.Entities.PasswordPolicy();
        policy.MinLength = request.MinLength;
        policy.RequireUppercase = request.RequireUppercase;
        policy.RequireLowercase = request.RequireLowercase;
        policy.RequireNumber = request.RequireNumber;
        policy.RequireSpecialChar = request.RequireSpecialChar;
        policy.MaxAgeDays = Math.Max(0, request.MaxAgeDays);

        await policyRepo.UpsertAsync(policy, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

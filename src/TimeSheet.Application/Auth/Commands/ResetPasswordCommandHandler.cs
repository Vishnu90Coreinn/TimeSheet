using MediatR;
using TimeSheet.Application.Common;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Auth.Commands;

public class ResetPasswordCommandHandler(
    IPasswordResetTokenRepository resetTokenRepo,
    IPasswordPolicyRepository policyRepo,
    IUserRepository userRepo,
    IPasswordHasher passwordHasher,
    IUnitOfWork unitOfWork,
    IDateTimeProvider dateTimeProvider)
    : IRequestHandler<ResetPasswordCommand, Result>
{
    public async Task<Result> Handle(ResetPasswordCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return Result.ValidationFailure("Reset token is required.");

        var resetToken = await resetTokenRepo.GetByTokenAsync(request.Token, cancellationToken);

        if (resetToken is null || resetToken.IsUsed)
            return Result.ValidationFailure("Invalid or expired reset token.");

        if (resetToken.ExpiresAtUtc < dateTimeProvider.UtcNow)
            return Result.ValidationFailure("Reset token has expired.");

        // Validate new password against policy
        var policy = await policyRepo.GetAsync(cancellationToken) ?? new Domain.Entities.PasswordPolicy();
        var errors = PasswordValidator.Validate(request.NewPassword ?? string.Empty, policy);
        if (errors.Length > 0)
            return Result.ValidationFailure(string.Join(" ", errors));

        var user = await userRepo.GetByIdAsync(resetToken.UserId, cancellationToken);
        if (user is null)
            return Result.NotFound("User not found.");

        user.PasswordHash = passwordHasher.Hash(request.NewPassword!);
        user.MustChangePasswordOnLogin = false;
        user.PasswordChangedAtUtc = dateTimeProvider.UtcNow;

        resetToken.UsedAtUtc = dateTimeProvider.UtcNow;

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

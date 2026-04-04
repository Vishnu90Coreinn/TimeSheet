using System.Security.Cryptography;
using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Auth.Commands;

public class VerifySecurityAnswerCommandHandler(
    IUserRepository userRepo,
    IPasswordHasher passwordHasher,
    IPasswordResetTokenRepository resetTokenRepo,
    IUnitOfWork unitOfWork,
    IDateTimeProvider dateTimeProvider)
    : IRequestHandler<VerifySecurityAnswerCommand, Result<VerifySecurityAnswerResult>>
{
    private const string Failure = "Security answer is incorrect.";

    public async Task<Result<VerifySecurityAnswerResult>> Handle(VerifySecurityAnswerCommand request, CancellationToken cancellationToken)
    {
        var identifier = request.Username?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(request.Answer))
            return Result<VerifySecurityAnswerResult>.Failure(Failure);

        var user = await userRepo.GetByUsernameOrEmailAsync(identifier, cancellationToken);

        if (user is null || string.IsNullOrWhiteSpace(user.SecurityAnswerHash))
            return Result<VerifySecurityAnswerResult>.Failure(Failure);

        if (!passwordHasher.Verify(request.Answer.Trim().ToLowerInvariant(), user.SecurityAnswerHash))
            return Result<VerifySecurityAnswerResult>.Failure(Failure);

        var token = RandomNumberGenerator.GetHexString(64);
        var expiresAt = dateTimeProvider.UtcNow.AddMinutes(15);

        var resetToken = new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = token,
            ExpiresAtUtc = expiresAt
        };

        await resetTokenRepo.AddAsync(resetToken, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<VerifySecurityAnswerResult>.Success(new VerifySecurityAnswerResult(token, expiresAt));
    }
}

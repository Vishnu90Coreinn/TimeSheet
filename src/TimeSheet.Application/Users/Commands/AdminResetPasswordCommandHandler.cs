using System.Security.Cryptography;
using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Users.Commands;

public class AdminResetPasswordCommandHandler(
    IUserRepository userRepo,
    IPasswordHasher passwordHasher,
    IRefreshTokenRepository refreshTokenRepo,
    IUnitOfWork unitOfWork)
    : IRequestHandler<AdminResetPasswordCommand, Result<string>>
{
    public async Task<Result<string>> Handle(AdminResetPasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await userRepo.GetByIdWithRefreshTokensAsync(request.TargetUserId, cancellationToken);
        if (user is null)
            return Result<string>.NotFound("User not found.");

        // Generate temp password: 2 uppercase + 2 digits + 4 lowercase
        var tempPassword = GenerateTempPassword();

        user.PasswordHash = passwordHasher.Hash(tempPassword);
        user.MustChangePasswordOnLogin = true;

        // Revoke all refresh tokens
        foreach (var rt in user.RefreshTokens.Where(t => !t.IsRevoked))
            refreshTokenRepo.Revoke(rt);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<string>.Success(tempPassword);
    }

    private static string GenerateTempPassword()
    {
        const string upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const string digits = "0123456789";
        const string lower = "abcdefghijklmnopqrstuvwxyz";

        var chars = new List<char>
        {
            upper[RandomNumberGenerator.GetInt32(upper.Length)],
            upper[RandomNumberGenerator.GetInt32(upper.Length)],
            digits[RandomNumberGenerator.GetInt32(digits.Length)],
            digits[RandomNumberGenerator.GetInt32(digits.Length)],
            lower[RandomNumberGenerator.GetInt32(lower.Length)],
            lower[RandomNumberGenerator.GetInt32(lower.Length)],
            lower[RandomNumberGenerator.GetInt32(lower.Length)],
            lower[RandomNumberGenerator.GetInt32(lower.Length)]
        };

        // Shuffle
        for (int i = chars.Count - 1; i > 0; i--)
        {
            int j = RandomNumberGenerator.GetInt32(i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }

        return new string(chars.ToArray());
    }
}

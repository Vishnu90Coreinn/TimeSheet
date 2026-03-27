using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Auth.Commands;

public class RefreshTokenCommandHandler(
    IRefreshTokenRepository refreshTokenRepo,
    ITokenService tokenService,
    IUnitOfWork unitOfWork,
    IDateTimeProvider dateTimeProvider,
    IJwtSettings jwtSettings)
    : IRequestHandler<RefreshTokenCommand, Result<LoginResult>>
{
    public async Task<Result<LoginResult>> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        var savedToken = await refreshTokenRepo.GetByTokenAsync(request.RefreshToken, cancellationToken);

        if (savedToken is null)
        {
            return Result<LoginResult>.Failure("Invalid refresh token.");
        }

        if (savedToken.IsRevoked || savedToken.ExpiresAtUtc <= dateTimeProvider.UtcNow || !savedToken.User.IsActive)
        {
            return Result<LoginResult>.Failure("Invalid refresh token.");
        }

        var roleName = savedToken.User.UserRoles.Select(ur => ur.Role.Name).FirstOrDefault() ?? "employee";

        refreshTokenRepo.Revoke(savedToken);

        var accessToken = tokenService.CreateAccessToken(savedToken.UserId, savedToken.User.Username, roleName);
        var newRefreshTokenString = tokenService.CreateRefreshToken();

        var newRefreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = savedToken.UserId,
            Token = newRefreshTokenString,
            ExpiresAtUtc = dateTimeProvider.UtcNow.AddDays(jwtSettings.RefreshTokenExpiryDays)
        };

        await refreshTokenRepo.AddAsync(newRefreshToken, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<LoginResult>.Success(new LoginResult(
            accessToken,
            newRefreshTokenString,
            savedToken.UserId,
            savedToken.User.Username,
            savedToken.User.Email,
            roleName,
            savedToken.User.OnboardingCompletedAt,
            savedToken.User.LeaveWorkflowVisitedAt));
    }
}

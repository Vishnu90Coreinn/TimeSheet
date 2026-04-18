using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Auth.Commands;

public class LoginCommandHandler(
    IUserRepository userRepo,
    IPasswordHasher passwordHasher,
    ITokenService tokenService,
    IRefreshTokenRepository refreshTokenRepo,
    IUnitOfWork unitOfWork,
    IDateTimeProvider dateTimeProvider,
    IJwtSettings jwtSettings)
    : IRequestHandler<LoginCommand, Result<LoginResult>>
{
    public async Task<Result<LoginResult>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var identifier = request.Identifier?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Result<LoginResult>.Failure("Username/email and password are required.");
        }

        var user = await userRepo.GetByUsernameOrEmailAsync(identifier, cancellationToken);

        if (user is null || !user.IsActive || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            return Result<LoginResult>.Failure("Invalid credentials.");
        }

        var roleName = user.UserRoles.Select(ur => ur.Role.Name).FirstOrDefault() ?? "employee";
        var accessToken = tokenService.CreateAccessToken(user.Id, user.Username, roleName);
        var refreshToken = tokenService.CreateRefreshToken();

        var newRefreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = refreshToken,
            ExpiresAtUtc = dateTimeProvider.UtcNow.AddDays(jwtSettings.RefreshTokenExpiryDays)
        };

        await refreshTokenRepo.AddAsync(newRefreshToken, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<LoginResult>.Success(new LoginResult(
            accessToken,
            refreshToken,
            user.Id,
            user.Username,
            user.Email,
            roleName,
            user.OnboardingCompletedAt,
            user.LeaveWorkflowVisitedAt,
            user.MustChangePasswordOnLogin));
    }
}

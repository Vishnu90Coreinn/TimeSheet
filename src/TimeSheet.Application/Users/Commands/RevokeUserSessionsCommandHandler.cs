using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Users.Commands;

public class RevokeUserSessionsCommandHandler(
    IUserRepository userRepo,
    IRefreshTokenRepository refreshTokenRepo,
    IUnitOfWork unitOfWork)
    : IRequestHandler<RevokeUserSessionsCommand, Result>
{
    public async Task<Result> Handle(RevokeUserSessionsCommand request, CancellationToken cancellationToken)
    {
        var user = await userRepo.GetByIdWithRefreshTokensAsync(request.TargetUserId, cancellationToken);
        if (user is null)
            return Result.NotFound("User not found.");

        foreach (var rt in user.RefreshTokens.Where(t => !t.IsRevoked))
            refreshTokenRepo.Revoke(rt);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

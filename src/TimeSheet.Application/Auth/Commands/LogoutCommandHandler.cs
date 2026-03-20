using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Auth.Commands;

public class LogoutCommandHandler(
    IRefreshTokenRepository refreshTokenRepo,
    IUnitOfWork unitOfWork)
    : IRequestHandler<LogoutCommand, Result>
{
    public async Task<Result> Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        var savedToken = await refreshTokenRepo.GetByTokenAsync(request.RefreshToken, cancellationToken);

        if (savedToken is not null)
        {
            refreshTokenRepo.Revoke(savedToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return Result.Success();
    }
}

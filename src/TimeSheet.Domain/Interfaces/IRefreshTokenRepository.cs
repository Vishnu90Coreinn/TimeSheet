using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken ct = default);
    Task AddAsync(RefreshToken refreshToken, CancellationToken ct = default);
    void Revoke(RefreshToken refreshToken);
}

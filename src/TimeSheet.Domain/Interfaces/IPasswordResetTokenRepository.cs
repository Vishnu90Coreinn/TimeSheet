using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IPasswordResetTokenRepository
{
    Task<PasswordResetToken?> GetByTokenAsync(string token, CancellationToken ct);
    Task AddAsync(PasswordResetToken token, CancellationToken ct);
    Task DeleteExpiredAsync(CancellationToken ct);
}

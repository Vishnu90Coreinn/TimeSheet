using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class PasswordResetTokenRepository(TimeSheetDbContext context) : IPasswordResetTokenRepository
{
    public async Task<PasswordResetToken?> GetByTokenAsync(string token, CancellationToken ct)
        => await context.PasswordResetTokens
            .FirstOrDefaultAsync(t => t.Token == token, ct);

    public async Task AddAsync(PasswordResetToken token, CancellationToken ct)
        => await context.PasswordResetTokens.AddAsync(token, ct);

    public async Task DeleteExpiredAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var expired = await context.PasswordResetTokens
            .Where(t => t.ExpiresAtUtc < now)
            .ToListAsync(ct);
        context.PasswordResetTokens.RemoveRange(expired);
    }
}

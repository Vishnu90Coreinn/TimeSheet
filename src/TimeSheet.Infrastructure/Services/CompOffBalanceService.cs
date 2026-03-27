using Microsoft.EntityFrameworkCore;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Infrastructure.Persistence;

namespace TimeSheet.Infrastructure.Services;

public class CompOffBalanceService(TimeSheetDbContext dbContext) : ICompOffBalanceService
{
    public async Task<(decimal Credits, DateTime? NextExpiryAtUtc)> GetActiveBalanceAsync(Guid userId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var balances = await dbContext.CompOffBalances
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.ExpiresAt > now)
            .ToListAsync(ct);

        var credits = balances.Sum(x => x.Credits);
        var nextExpiry = balances.Count == 0 ? (DateTime?)null : balances.Min(x => x.ExpiresAt);
        return (Math.Round(credits, 2, MidpointRounding.AwayFromZero), nextExpiry);
    }
}


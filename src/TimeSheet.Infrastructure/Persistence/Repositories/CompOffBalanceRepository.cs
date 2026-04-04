using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class CompOffBalanceRepository(TimeSheetDbContext dbContext) : ICompOffBalanceRepository
{
    public async Task<CompOffBalanceSummaryRow> GetActiveBalanceAsync(Guid userId, DateTime nowUtc, CancellationToken ct = default)
    {
        var balances = await dbContext.CompOffBalances
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.ExpiresAt > nowUtc)
            .ToListAsync(ct);

        var credits = Math.Round(balances.Sum(x => x.Credits), 2, MidpointRounding.AwayFromZero);
        var nextExpiry = balances.Count == 0 ? (DateTime?)null : balances.Min(x => x.ExpiresAt);
        return new CompOffBalanceSummaryRow(credits, nextExpiry);
    }
}

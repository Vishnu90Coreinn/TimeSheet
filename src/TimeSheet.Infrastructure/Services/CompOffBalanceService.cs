using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class CompOffBalanceService(ICompOffBalanceRepository compOffBalanceRepository) : ICompOffBalanceService
{
    public async Task<(decimal Credits, DateTime? NextExpiryAtUtc)> GetActiveBalanceAsync(Guid userId, CancellationToken ct = default)
    {
        var summary = await compOffBalanceRepository.GetActiveBalanceAsync(userId, DateTime.UtcNow, ct);
        return (summary.Credits, summary.NextExpiryAtUtc);
    }
}

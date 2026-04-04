namespace TimeSheet.Domain.Interfaces;

public interface ICompOffBalanceRepository
{
    Task<CompOffBalanceSummaryRow> GetActiveBalanceAsync(Guid userId, DateTime nowUtc, CancellationToken ct = default);
}

public record CompOffBalanceSummaryRow(decimal Credits, DateTime? NextExpiryAtUtc);

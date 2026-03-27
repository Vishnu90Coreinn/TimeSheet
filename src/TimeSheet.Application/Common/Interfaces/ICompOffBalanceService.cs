namespace TimeSheet.Application.Common.Interfaces;

public interface ICompOffBalanceService
{
    Task<(decimal Credits, DateTime? NextExpiryAtUtc)> GetActiveBalanceAsync(Guid userId, CancellationToken ct = default);
}


using TimeSheet.Application.Privacy.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface IPrivacyService
{
    Task<ExportRequestResult> RequestExportAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<ExportRequestResult>> GetExportRequestsAsync(Guid userId, CancellationToken ct = default);
    Task<bool> DeleteAccountAsync(Guid userId, CancellationToken ct = default);
    Task LogConsentAsync(Guid userId, string consentType, bool granted, string? ipAddress, CancellationToken ct = default);
}

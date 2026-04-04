using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IPrivacyRepository
{
    Task<DataExportRequest?> GetPendingExportRequestAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<DataExportRequest>> GetRecentExportRequestsAsync(Guid userId, int take, CancellationToken ct = default);
    Task<DataExportRequest?> GetExportRequestByIdAsync(Guid requestId, CancellationToken ct = default);
    Task<User?> GetUserByIdAsync(Guid userId, CancellationToken ct = default);
    Task<PrivacyExportPayload?> GetExportPayloadAsync(Guid userId, CancellationToken ct = default);
    void AddExportRequest(DataExportRequest request);
    void AddConsentLog(ConsentLog log);
}

public record PrivacyExportPayload(
    string? Username,
    string? DisplayName,
    string? Email,
    IReadOnlyList<PrivacyExportTimesheetEntry> TimesheetEntries,
    IReadOnlyList<PrivacyExportLeaveRequest> LeaveRequests);

public record PrivacyExportTimesheetEntry(DateOnly WorkDate, int Minutes, string? Notes);
public record PrivacyExportLeaveRequest(DateOnly LeaveDate, string Status);

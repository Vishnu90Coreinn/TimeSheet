using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class PrivacyRepository(TimeSheetDbContext context) : IPrivacyRepository
{
    public async Task<DataExportRequest?> GetPendingExportRequestAsync(Guid userId, CancellationToken ct = default)
        => await context.DataExportRequests.FirstOrDefaultAsync(r => r.UserId == userId && r.Status == "Pending", ct);

    public async Task<IReadOnlyList<DataExportRequest>> GetRecentExportRequestsAsync(Guid userId, int take, CancellationToken ct = default)
        => await context.DataExportRequests.AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.RequestedAt)
            .Take(take)
            .ToListAsync(ct);

    public async Task<DataExportRequest?> GetExportRequestByIdAsync(Guid requestId, CancellationToken ct = default)
        => await context.DataExportRequests.FirstOrDefaultAsync(r => r.Id == requestId, ct);

    public async Task<User?> GetUserByIdAsync(Guid userId, CancellationToken ct = default)
        => await context.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);

    public async Task<PrivacyExportPayload?> GetExportPayloadAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return null;

        var entries = await context.TimesheetEntries.AsNoTracking()
            .Include(e => e.Timesheet)
            .Where(e => e.Timesheet.UserId == userId)
            .OrderByDescending(e => e.Timesheet.WorkDate)
            .Take(500)
            .Select(e => new PrivacyExportTimesheetEntry(e.Timesheet.WorkDate, e.Minutes, e.Notes))
            .ToListAsync(ct);

        var leaves = await context.LeaveRequests.AsNoTracking()
            .Where(l => l.UserId == userId)
            .OrderByDescending(l => l.LeaveDate)
            .Take(200)
            .Select(l => new PrivacyExportLeaveDbRow(l.LeaveDate, l.Status))
            .ToListAsync(ct);

        return new PrivacyExportPayload(
            user.Username,
            user.DisplayName,
            user.Email,
            entries,
            leaves.Select(x => new PrivacyExportLeaveRequest(x.LeaveDate, x.Status.ToString())).ToList());
    }

    public void AddExportRequest(DataExportRequest request) => context.DataExportRequests.Add(request);

    public void AddConsentLog(ConsentLog log) => context.ConsentLogs.Add(log);

    private sealed record PrivacyExportLeaveDbRow(DateOnly LeaveDate, LeaveRequestStatus Status);
}

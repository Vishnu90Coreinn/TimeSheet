using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Privacy.Queries;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class PrivacyService(
    IPrivacyRepository privacyRepository,
    IUnitOfWork unitOfWork,
    IWebHostEnvironment env,
    IServiceScopeFactory scopeFactory) : IPrivacyService
{
    public async Task<ExportRequestResult> RequestExportAsync(Guid userId, CancellationToken ct = default)
    {
        var existing = await privacyRepository.GetPendingExportRequestAsync(userId, ct);
        if (existing is not null)
            return Map(existing);

        var request = new DataExportRequest { UserId = userId };
        privacyRepository.AddExportRequest(request);
        await unitOfWork.SaveChangesAsync(ct);

        _ = Task.Run(() => ProcessExportAsync(request.Id, userId));
        return Map(request);
    }

    public async Task<IReadOnlyList<ExportRequestResult>> GetExportRequestsAsync(Guid userId, CancellationToken ct = default)
        => (await privacyRepository.GetRecentExportRequestsAsync(userId, 10, ct)).Select(Map).ToList();

    public async Task<bool> DeleteAccountAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await privacyRepository.GetUserByIdAsync(userId, ct);
        if (user is null) return false;
        user.Username = $"deleted-{userId}";
        user.DisplayName = "Deleted User";
        user.Email = $"deleted-{userId}@anon.local";
        user.PasswordHash = string.Empty;
        await unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task LogConsentAsync(Guid userId, string consentType, bool granted, string? ipAddress, CancellationToken ct = default)
    {
        privacyRepository.AddConsentLog(new ConsentLog
        {
            UserId = userId,
            ConsentType = consentType,
            Granted = granted,
            IpAddress = ipAddress
        });
        await unitOfWork.SaveChangesAsync(ct);
    }

    private async Task ProcessExportAsync(Guid requestId, Guid userId)
    {
        using var scope = scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IPrivacyRepository>();
        var uow = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        try
        {
            var payload = await repo.GetExportPayloadAsync(userId);
            var export = new
            {
                exportedAt = DateTime.UtcNow,
                profile = payload is null ? null : new { payload.Username, payload.DisplayName, payload.Email },
                timesheetEntries = payload?.TimesheetEntries ?? [],
                leaveRequests = payload?.LeaveRequests ?? []
            };

            var json = JsonSerializer.Serialize(export, new JsonSerializerOptions { WriteIndented = true });
            var webRoot = env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var exportsDir = Path.Combine(webRoot, "exports");
            Directory.CreateDirectory(exportsDir);
            var fileName = $"export-{userId}-{DateTime.UtcNow:yyyyMMddHHmmss}.json";
            await File.WriteAllTextAsync(Path.Combine(exportsDir, fileName), json, Encoding.UTF8);

            var req = await repo.GetExportRequestByIdAsync(requestId);
            if (req is not null)
            {
                req.Status = "Completed";
                req.CompletedAt = DateTime.UtcNow;
                req.DownloadUrl = $"/exports/{fileName}";
                await uow.SaveChangesAsync();
            }
        }
        catch
        {
            var req = await repo.GetExportRequestByIdAsync(requestId);
            if (req is not null)
            {
                req.Status = "Failed";
                await uow.SaveChangesAsync();
            }
        }
    }

    private static ExportRequestResult Map(DataExportRequest r) => new(r.Id, r.Status, r.RequestedAt, r.CompletedAt, r.DownloadUrl);
}

using Microsoft.AspNetCore.Hosting;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class TenantSettingsService(
    ITenantSettingsRepository tenantSettingsRepository,
    IUnitOfWork unitOfWork,
    IWebHostEnvironment environment) : ITenantSettingsService
{
    private static readonly HashSet<string> AllowedExtensions =
    [
        ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp"
    ];

    public async Task<TenantSettingsResult> GetAsync(CancellationToken ct = default)
    {
        var settings = await tenantSettingsRepository.GetAsync(ct);
        return settings is null
            ? new TenantSettingsResult("TimeSheet", null, null, null, null)
            : Map(settings);
    }

    public async Task<TenantSettingsResult> UpdateAsync(
        string? appName,
        string? primaryColor,
        string? customDomain,
        TenantAssetUpload? logo,
        TenantAssetUpload? favicon,
        CancellationToken ct = default)
    {
        var settings = await tenantSettingsRepository.GetAsync(ct);
        if (settings is null)
        {
            settings = new TenantSettings();
            tenantSettingsRepository.Add(settings);
        }

        if (appName is not null) settings.AppName = appName;
        if (primaryColor is not null) settings.PrimaryColor = primaryColor;
        if (customDomain is not null) settings.CustomDomain = string.IsNullOrWhiteSpace(customDomain) ? null : customDomain;
        if (logo is not null) settings.LogoUrl = await SaveUploadAsync(logo, "logo", ct);
        if (favicon is not null) settings.FaviconUrl = await SaveUploadAsync(favicon, "favicon", ct);

        await unitOfWork.SaveChangesAsync(ct);
        return Map(settings);
    }

    public async Task RemoveLogoAsync(CancellationToken ct = default)
    {
        var settings = await tenantSettingsRepository.GetAsync(ct);
        if (settings is null)
            return;

        settings.LogoUrl = null;
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task RemoveFaviconAsync(CancellationToken ct = default)
    {
        var settings = await tenantSettingsRepository.GetAsync(ct);
        if (settings is null)
            return;

        settings.FaviconUrl = null;
        await unitOfWork.SaveChangesAsync(ct);
    }

    private async Task<string> SaveUploadAsync(TenantAssetUpload file, string prefix, CancellationToken ct)
    {
        var webRoot = environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var uploadsDir = Path.Combine(webRoot, "uploads");
        Directory.CreateDirectory(uploadsDir);

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            ext = ".png";

        var fileName = $"{prefix}{ext}";
        var filePath = Path.Combine(uploadsDir, fileName);

        await using var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None);
        await file.Content.CopyToAsync(stream, ct);

        return $"/uploads/{fileName}";
    }

    private static TenantSettingsResult Map(TenantSettings settings)
        => new(settings.AppName, settings.LogoUrl, settings.FaviconUrl, settings.PrimaryColor, settings.CustomDomain);
}

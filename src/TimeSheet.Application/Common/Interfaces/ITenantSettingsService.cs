namespace TimeSheet.Application.Common.Interfaces;

public interface ITenantSettingsService
{
    Task<TenantSettingsResult> GetAsync(CancellationToken ct = default);
    Task<TenantSettingsResult> UpdateAsync(
        string? appName,
        string? primaryColor,
        string? customDomain,
        TenantAssetUpload? logo,
        TenantAssetUpload? favicon,
        CancellationToken ct = default);
    Task RemoveLogoAsync(CancellationToken ct = default);
    Task RemoveFaviconAsync(CancellationToken ct = default);
}

public record TenantSettingsResult(
    string AppName,
    string? LogoUrl,
    string? FaviconUrl,
    string? PrimaryColor,
    string? CustomDomain);

public record TenantAssetUpload(string FileName, Stream Content);

namespace TimeSheet.Api.Dtos;

public record TenantSettingsResponse(
    string AppName,
    string? LogoUrl,
    string? FaviconUrl,
    string? PrimaryColor,
    string? CustomDomain);

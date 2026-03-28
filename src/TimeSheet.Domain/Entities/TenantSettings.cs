namespace TimeSheet.Domain.Entities;

public class TenantSettings
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string AppName { get; set; } = "TimeSheet";
    public string? LogoUrl { get; set; }
    public string? FaviconUrl { get; set; }
    public string? PrimaryColor { get; set; }
    public string? CustomDomain { get; set; }
}

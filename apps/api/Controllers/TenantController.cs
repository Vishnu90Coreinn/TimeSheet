using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/tenant")]
public class TenantController(TimeSheetDbContext dbContext, IWebHostEnvironment env) : ControllerBase
{
    [HttpGet("settings")]
    [AllowAnonymous]
    public async Task<ActionResult<TenantSettingsResponse>> GetSettings()
    {
        var settings = await dbContext.TenantSettings.AsNoTracking().FirstOrDefaultAsync();
        if (settings is null)
            return Ok(new TenantSettingsResponse("TimeSheet", null, null, null, null));

        return Ok(new TenantSettingsResponse(
            settings.AppName,
            settings.LogoUrl,
            settings.FaviconUrl,
            settings.PrimaryColor,
            settings.CustomDomain));
    }

    [HttpPut("settings")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<TenantSettingsResponse>> UpdateSettings(
        [FromForm] string? appName,
        [FromForm] string? primaryColor,
        [FromForm] string? customDomain,
        IFormFile? logo,
        IFormFile? favicon)
    {
        var settings = await dbContext.TenantSettings.FirstOrDefaultAsync();
        if (settings is null)
        {
            settings = new TenantSettings();
            dbContext.TenantSettings.Add(settings);
        }

        if (appName is not null) settings.AppName = appName;
        if (primaryColor is not null) settings.PrimaryColor = primaryColor;
        if (customDomain is not null) settings.CustomDomain = customDomain == "" ? null : customDomain;

        if (logo is not null)
            settings.LogoUrl = await SaveUpload(logo, "logo");

        if (favicon is not null)
            settings.FaviconUrl = await SaveUpload(favicon, "favicon");

        await dbContext.SaveChangesAsync();

        return Ok(new TenantSettingsResponse(
            settings.AppName,
            settings.LogoUrl,
            settings.FaviconUrl,
            settings.PrimaryColor,
            settings.CustomDomain));
    }

    [HttpDelete("settings/logo")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> RemoveLogo()
    {
        var settings = await dbContext.TenantSettings.FirstOrDefaultAsync();
        if (settings is null) return NoContent();
        settings.LogoUrl = null;
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("settings/favicon")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> RemoveFavicon()
    {
        var settings = await dbContext.TenantSettings.FirstOrDefaultAsync();
        if (settings is null) return NoContent();
        settings.FaviconUrl = null;
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    private async Task<string> SaveUpload(IFormFile file, string prefix)
    {
        var webRoot = env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var uploadsDir = Path.Combine(webRoot, "uploads");
        Directory.CreateDirectory(uploadsDir);

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowed = new[] { ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp" };
        if (!allowed.Contains(ext)) ext = ".png";

        var fileName = $"{prefix}{ext}";
        var filePath = Path.Combine(uploadsDir, fileName);

        await using var stream = new FileStream(filePath, FileMode.Create);
        await file.CopyToAsync(stream);

        return $"/uploads/{fileName}";
    }
}

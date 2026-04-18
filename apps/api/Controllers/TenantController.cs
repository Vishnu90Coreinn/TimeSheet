using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Extensions;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Tenant.Commands;
using TimeSheet.Application.Tenant.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/tenant")]
public class TenantController(ISender mediator) : ControllerBase
{
    [HttpGet("settings")]
    [AllowAnonymous]
    public async Task<IActionResult> GetSettings()
    {
        var result = await mediator.Send(new GetTenantSettingsQuery());
        return result.IsSuccess ? Ok(ToResponse(result.Value!)) : result.ToActionResult();
    }

    [HttpPut("settings")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateSettings(
        [FromForm] string? appName,
        [FromForm] string? primaryColor,
        [FromForm] string? customDomain,
        IFormFile? logo,
        IFormFile? favicon,
        CancellationToken ct)
    {
        await using var logoStream = logo?.OpenReadStream();
        await using var faviconStream = favicon?.OpenReadStream();

        var result = await mediator.Send(new UpdateTenantSettingsCommand(
            appName,
            primaryColor,
            customDomain,
            logoStream is null ? null : new TenantAssetUpload(logo!.FileName, logoStream),
            faviconStream is null ? null : new TenantAssetUpload(favicon!.FileName, faviconStream)), ct);

        return result.IsSuccess ? Ok(ToResponse(result.Value!)) : result.ToActionResult();
    }

    [HttpDelete("settings/logo")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> RemoveLogo(CancellationToken ct)
    {
        var result = await mediator.Send(new RemoveTenantLogoCommand(), ct);
        return result.IsSuccess ? NoContent() : result.ToActionResult();
    }

    [HttpDelete("settings/favicon")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> RemoveFavicon(CancellationToken ct)
    {
        var result = await mediator.Send(new RemoveTenantFaviconCommand(), ct);
        return result.IsSuccess ? NoContent() : result.ToActionResult();
    }

    private static TenantSettingsResponse ToResponse(TenantSettingsResult settings)
        => new(settings.AppName, settings.LogoUrl, settings.FaviconUrl, settings.PrimaryColor, settings.CustomDomain);
}

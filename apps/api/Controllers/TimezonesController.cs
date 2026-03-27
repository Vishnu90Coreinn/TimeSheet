using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/timezones")]
public class TimezonesController : ControllerBase
{
    [HttpGet]
    public IActionResult GetTimezones()
    {
        var timezones = TimeZoneInfo
            .GetSystemTimeZones()
            .Select(tz => new
            {
                id = tz.Id,
                displayName = tz.DisplayName
            })
            .OrderBy(tz => tz.id)
            .ToList();

        return Ok(timezones);
    }
}

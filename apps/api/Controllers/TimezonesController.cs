using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Utilities;

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
                id = TimeZoneIdMapper.NormalizeForClient(tz.Id),
                displayName = tz.DisplayName
            })
            .GroupBy(tz => tz.id)
            .Select(group => group.First())
            .OrderBy(tz => tz.id)
            .ToList();

        return Ok(timezones);
    }
}

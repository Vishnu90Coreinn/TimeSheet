using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/holidays")]
public class HolidaysController(TimeSheetDbContext dbContext, ILogger<HolidaysController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? year = null)
    {
        var effectiveYear = year ?? DateTime.UtcNow.Year;
        var from = new DateOnly(effectiveYear, 1, 1);
        var to = new DateOnly(effectiveYear, 12, 31);

        var holidays = await dbContext.Holidays.AsNoTracking()
            .Where(h => h.Date >= from && h.Date <= to)
            .OrderBy(h => h.Date)
            .Select(h => new HolidayResponse(h.Id, h.Name, h.Date, h.IsRecurring, h.CreatedAtUtc))
            .ToListAsync();

        return Ok(holidays);
    }

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] UpsertHolidayRequest request)
    {
        var holiday = new Holiday
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Date = request.Date,
            IsRecurring = request.IsRecurring,
            CreatedAtUtc = DateTime.UtcNow
        };

        dbContext.Holidays.Add(holiday);
        await dbContext.SaveChangesAsync();
        logger.LogInformation("Holiday created: {Name} on {Date}", holiday.Name, holiday.Date);

        return CreatedAtAction(nameof(GetAll), new { year = holiday.Date.Year },
            new HolidayResponse(holiday.Id, holiday.Name, holiday.Date, holiday.IsRecurring, holiday.CreatedAtUtc));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertHolidayRequest request)
    {
        var holiday = await dbContext.Holidays.SingleOrDefaultAsync(h => h.Id == id);
        if (holiday is null) return NotFound();

        holiday.Name = request.Name.Trim();
        holiday.Date = request.Date;
        holiday.IsRecurring = request.IsRecurring;

        await dbContext.SaveChangesAsync();
        logger.LogInformation("Holiday updated: {Id}", id);
        return Ok(new HolidayResponse(holiday.Id, holiday.Name, holiday.Date, holiday.IsRecurring, holiday.CreatedAtUtc));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var holiday = await dbContext.Holidays.SingleOrDefaultAsync(h => h.Id == id);
        if (holiday is null) return NotFound();

        dbContext.Holidays.Remove(holiday);
        await dbContext.SaveChangesAsync();
        logger.LogInformation("Holiday deleted: {Id}", id);
        return NoContent();
    }
}

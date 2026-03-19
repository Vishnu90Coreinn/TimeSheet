using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Application.Holidays.Handlers;
using TimeSheet.Api.Application.Holidays.Models;
using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Route("api/v1/holidays")]
public class HolidaysController(
    IGetHolidaysHandler getHolidaysHandler,
    ICreateHolidayHandler createHolidayHandler,
    IUpdateHolidayHandler updateHolidayHandler,
    IDeleteHolidayHandler deleteHolidayHandler,
    ILogger<HolidaysController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] HolidayListQuery query, CancellationToken cancellationToken)
    {
        var (data, error) = await getHolidaysHandler.HandleAsync(query, cancellationToken);
        if (error is not null)
        {
            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        return Ok(data);
    }

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] UpsertHolidayRequest request, CancellationToken cancellationToken)
    {
        var (data, error) = await createHolidayHandler.HandleAsync(request, cancellationToken);
        if (error is not null)
        {
            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        logger.LogInformation(ApiMessages.HolidayCreatedLog, data!.Name, data.Date);
        return CreatedAtAction(nameof(GetAll), new { year = data.Date.Year }, data);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertHolidayRequest request, CancellationToken cancellationToken)
    {
        var (data, error) = await updateHolidayHandler.HandleAsync(id, request, cancellationToken);
        if (error is not null)
        {
            if (error.Code == ErrorCodes.HolidayNotFound)
            {
                return NotFound(new { message = error.Message, code = error.Code });
            }

            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        logger.LogInformation(ApiMessages.HolidayUpdatedLog, id);
        return Ok(data);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var error = await deleteHolidayHandler.HandleAsync(id, cancellationToken);
        if (error is not null)
        {
            if (error.Code == ErrorCodes.HolidayNotFound)
            {
                return NotFound(new { message = error.Message, code = error.Code });
            }

            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        logger.LogInformation(ApiMessages.HolidayDeletedLog, id);
        return NoContent();
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Application.Roles.Handlers;
using TimeSheet.Api.Application.Roles.Models;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/roles")]
public class RolesController(IGetRolesHandler getRolesHandler, ICreateRoleHandler createRoleHandler) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> GetAll([FromQuery] RoleListQuery query, CancellationToken cancellationToken)
    {
        var (data, error) = await getRolesHandler.HandleAsync(query, cancellationToken);
        if (error is not null)
        {
            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        return Ok(data);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] AssignRoleRequest request, CancellationToken cancellationToken)
    {
        var (data, error) = await createRoleHandler.HandleAsync(request, cancellationToken);
        if (error is not null)
        {
            return StatusCode(error.StatusCode, new { message = error.Message, code = error.Code });
        }

        return Ok(data);
    }
}

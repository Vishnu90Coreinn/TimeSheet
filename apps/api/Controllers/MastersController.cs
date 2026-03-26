using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.ReferenceData.Commands;
using TimeSheet.Application.ReferenceData.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/masters")]
public class MastersController(ISender mediator) : ControllerBase
{
    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments(CancellationToken ct)
    {
        var result = await mediator.Send(new GetDepartmentsQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [HttpPost("departments")]
    public async Task<IActionResult> CreateDepartment([FromBody] DepartmentResponse request, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateDepartmentCommand(request.Name, request.IsActive), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [HttpGet("work-policies")]
    public async Task<IActionResult> GetWorkPolicies(CancellationToken ct)
    {
        var result = await mediator.Send(new GetWorkPoliciesQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [HttpPost("work-policies")]
    public async Task<IActionResult> CreateWorkPolicy([FromBody] WorkPolicyResponse request, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateWorkPolicyCommand(request.Name, request.DailyExpectedMinutes, request.WorkDaysPerWeek, request.IsActive), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [HttpPut("work-policies/{id:guid}")]
    public async Task<IActionResult> UpdateWorkPolicy(Guid id, [FromBody] WorkPolicyResponse request, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateWorkPolicyCommand(id, request.Name, request.DailyExpectedMinutes, request.WorkDaysPerWeek, request.IsActive), ct);
        return result.IsSuccess ? Ok(result.Value) : Fail(result);
    }

    [HttpDelete("work-policies/{id:guid}")]
    public async Task<IActionResult> DeleteWorkPolicy(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteWorkPolicyCommand(id), ct);
        if (!result.IsSuccess) return Fail(result);
        return NoContent();
    }

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Forbid(),
        ResultStatus.Conflict => Conflict(new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

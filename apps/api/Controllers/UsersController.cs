using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Users.Commands;
using TimeSheet.Application.Users.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/users")]
public class UsersController(ISender mediator) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResponse<UserResponse>>> GetAll([FromQuery] UsersListQuery queryParams)
    {
        var sortBy = (queryParams.SortBy ?? "username").Trim().ToLowerInvariant();
        var sortDir = (queryParams.SortDir ?? "asc").Trim().ToLowerInvariant();
        var pageSize = Math.Clamp(queryParams.PageSize, 1, 200);

        var result = await mediator.Send(new GetUsersPageQuery(
            queryParams.Search,
            queryParams.Role,
            queryParams.DepartmentId,
            queryParams.IsActive,
            sortBy,
            sortDir == "desc",
            Math.Max(1, queryParams.Page),
            pageSize));

        if (!result.IsSuccess)
            return BadRequest(new { message = result.Error });

        var page = result.Value!;
        return Ok(new PagedResponse<UserResponse>(
            page.Items.Select(ToResponse).ToList(),
            page.Page,
            page.PageSize,
            page.TotalCount,
            page.TotalPages,
            page.SortBy,
            page.SortDir));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetUserByIdQuery(id), ct);
        return result.IsSuccess ? Ok(ToResponse(result.Value!)) : Fail(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertUserRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateUserCommand(
            request.Username,
            request.Email,
            request.EmployeeId,
            request.Password,
            request.Role,
            request.IsActive,
            request.DepartmentId,
            request.WorkPolicyId,
            request.LeavePolicyId,
            request.ManagerId), ct);

        return result.IsSuccess
            ? CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, ToResponse(result.Value))
            : Fail(result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateUserCommand(
            id,
            request.Username,
            request.Email,
            request.EmployeeId,
            request.Role,
            request.IsActive,
            request.DepartmentId,
            request.WorkPolicyId,
            request.LeavePolicyId,
            request.ManagerId), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    [HttpPost("{id:guid}/manager")]
    public async Task<IActionResult> SetManager(Guid id, [FromBody] SetManagerRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new SetUserManagerCommand(id, request.ManagerId), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    [HttpGet("{id:guid}/reportees")]
    public async Task<IActionResult> GetReportees(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetUserReporteesQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value!.Select(ToResponse).ToList()) : Fail(result);
    }

    [HttpPost("{id:guid}/roles")]
    public async Task<IActionResult> AssignRole(Guid id, [FromBody] AssignRoleRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new AssignUserRoleCommand(id, request.RoleName), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    private static UserResponse ToResponse(UserListItemResult u)
        => new(
            u.Id,
            u.Username,
            u.Email,
            u.EmployeeId,
            u.Role,
            u.IsActive,
            u.DepartmentId,
            u.DepartmentName,
            u.WorkPolicyId,
            u.WorkPolicyName,
            u.LeavePolicyId,
            u.LeavePolicyName,
            u.ManagerId,
            u.ManagerUsername,
            u.OnboardingCompletedAt,
            u.LeaveWorkflowVisitedAt);

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Unauthorized(),
        ResultStatus.Conflict => Conflict(new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

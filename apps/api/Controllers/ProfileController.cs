using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Dtos;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Profile.Commands;
using TimeSheet.Application.Profile.Queries;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/profile")]
public class ProfileController(ISender mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetMyProfile(CancellationToken ct)
    {
        var result = await mediator.Send(new GetMyProfileQuery(), ct);
        if (!result.IsSuccess) return Fail(result);
        return Ok(new MyProfileResponse(
                result.Value!.Id,
                result.Value.Username,
                result.Value.DisplayName,
                result.Value.Email,
                result.Value.EmployeeId,
                result.Value.Role,
                result.Value.DepartmentName,
                result.Value.WorkPolicyName,
                result.Value.LeavePolicyName,
                result.Value.ManagerUsername,
                result.Value.AvatarDataUrl,
                result.Value.TimeZoneId));
    }

    [HttpPut]
    public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateMyProfileRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateMyProfileCommand(request.Username, request.DisplayName, request.Email, request.TimeZoneId), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    [HttpPut("avatar")]
    public async Task<IActionResult> UpdateAvatar([FromBody] UpdateAvatarRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateAvatarCommand(request.AvatarDataUrl), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new ChangePasswordCommand(request.CurrentPassword, request.NewPassword), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    [HttpGet("security-question")]
    public async Task<IActionResult> GetSecurityQuestionStatus(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();
        var result = await mediator.Send(new GetSecurityQuestionStatusQuery(userId), ct);
        if (!result.IsSuccess) return Fail(result);
        return Ok(new SecurityQuestionStatusResponse(result.Value!.HasQuestion, result.Value.Question));
    }

    [HttpPut("security-question")]
    public async Task<IActionResult> SetSecurityQuestion([FromBody] SetSecurityQuestionRequest request, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();
        var result = await mediator.Send(new SetSecurityQuestionCommand(userId, request.Question, request.Answer, request.CurrentPassword), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    private Guid GetCurrentUserId()
    {
        var claim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)
                    ?? User.FindFirst("sub");
        return claim is not null && Guid.TryParse(claim.Value, out var id) ? id : Guid.Empty;
    }

    [HttpGet("notification-preferences")]
    public async Task<IActionResult> GetNotificationPreferences(CancellationToken ct)
    {
        var result = await mediator.Send(new GetNotificationPreferencesQuery(), ct);
        if (!result.IsSuccess) return Fail(result);
        return Ok(new NotificationPreferencesResponse(
                result.Value!.OnApproval,
                result.Value.OnRejection,
                result.Value.OnLeaveStatus,
                result.Value.OnReminder,
                result.Value.InAppEnabled,
                result.Value.EmailEnabled));
    }

    [HttpPut("notification-preferences")]
    public async Task<IActionResult> UpdateNotificationPreferences([FromBody] UpdateNotificationPreferencesRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateNotificationPreferencesCommand(
            new NotificationPreferencesResult(
                request.OnApproval,
                request.OnRejection,
                request.OnLeaveStatus,
                request.OnReminder,
                request.InAppEnabled,
                request.EmailEnabled)), ct);
        return result.IsSuccess ? NoContent() : Fail(result);
    }

    private IActionResult Fail(Result result) => result.Status switch
    {
        ResultStatus.NotFound => NotFound(new { message = result.Error }),
        ResultStatus.Forbidden => Unauthorized(),
        ResultStatus.Conflict => Conflict(new { message = result.Error }),
        ResultStatus.Validation => BadRequest(new { message = result.Error }),
        _ => BadRequest(new { message = result.Error })
    };
}

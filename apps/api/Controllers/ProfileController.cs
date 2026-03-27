using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Utilities;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/profile")]
public class ProfileController(TimeSheetDbContext dbContext, AppInterfaces.IPasswordHasher passwordHasher) : ControllerBase
{
    private Guid? GetUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    // ── GET /profile ────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<ActionResult<MyProfileResponse>> GetMyProfile()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var user = await dbContext.Users.AsNoTracking()
            .Include(u => u.Department)
            .Include(u => u.WorkPolicy)
            .Include(u => u.LeavePolicy)
            .Include(u => u.Manager)
            .SingleOrDefaultAsync(u => u.Id == userId.Value);

        if (user is null) return NotFound();

        return Ok(new MyProfileResponse(
            user.Id,
            user.Username,
            user.DisplayName,
            user.Email,
            user.EmployeeId,
            user.Role,
            user.Department?.Name,
            user.WorkPolicy?.Name,
            user.LeavePolicy?.Name,
            user.Manager?.Username,
            user.AvatarDataUrl,
            TimeZoneIdMapper.NormalizeForClient(user.TimeZoneId)
        ));
    }

    // ── PUT /profile ────────────────────────────────────────────────────────

    [HttpPut]
    public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateMyProfileRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var user = await dbContext.Users.SingleOrDefaultAsync(u => u.Id == userId.Value);
        if (user is null) return NotFound();

        var duplicate = await dbContext.Users.AnyAsync(u =>
            u.Id != userId.Value &&
            (u.Username == request.Username.Trim() || u.Email == request.Email.Trim()));
        if (duplicate)
            return Conflict(new { message = "Username or email already in use by another account." });

        user.Username = request.Username.Trim();
        user.DisplayName = request.DisplayName?.Trim() ?? string.Empty;
        user.Email = request.Email.Trim();
        if (!TimeZoneIdMapper.TryNormalize(request.TimeZoneId, out var requestedTimeZoneId))
            return BadRequest(new { message = "Invalid timeZoneId." });
        user.TimeZoneId = requestedTimeZoneId;

        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    // ── PUT /profile/avatar ──────────────────────────────────────────────────

    [HttpPut("avatar")]
    public async Task<IActionResult> UpdateAvatar([FromBody] UpdateAvatarRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var user = await dbContext.Users.SingleOrDefaultAsync(u => u.Id == userId.Value);
        if (user is null) return NotFound();

        // Validate it's a valid image data URL when provided
        if (request.AvatarDataUrl is not null &&
            !request.AvatarDataUrl.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Invalid image format." });

        user.AvatarDataUrl = request.AvatarDataUrl;
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    // ── PUT /profile/password ────────────────────────────────────────────────

    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var user = await dbContext.Users.SingleOrDefaultAsync(u => u.Id == userId.Value);
        if (user is null) return NotFound();

        if (!passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
            return BadRequest(new { message = "Current password is incorrect." });

        user.PasswordHash = passwordHasher.Hash(request.NewPassword);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    // ── GET /profile/notification-preferences ───────────────────────────────

    [HttpGet("notification-preferences")]
    public async Task<ActionResult<NotificationPreferencesResponse>> GetNotificationPreferences()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var prefs = await dbContext.UserNotificationPreferences
            .AsNoTracking()
            .SingleOrDefaultAsync(p => p.UserId == userId.Value);

        if (prefs is null)
            return Ok(new NotificationPreferencesResponse(true, true, true, true, true, false));

        return Ok(new NotificationPreferencesResponse(
            prefs.OnApproval,
            prefs.OnRejection,
            prefs.OnLeaveStatus,
            prefs.OnReminder,
            prefs.InAppEnabled,
            prefs.EmailEnabled
        ));
    }

    // ── PUT /profile/notification-preferences ───────────────────────────────

    [HttpPut("notification-preferences")]
    public async Task<IActionResult> UpdateNotificationPreferences([FromBody] UpdateNotificationPreferencesRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var prefs = await dbContext.UserNotificationPreferences
            .SingleOrDefaultAsync(p => p.UserId == userId.Value);

        if (prefs is null)
        {
            prefs = new UserNotificationPreferences { UserId = userId.Value };
            dbContext.UserNotificationPreferences.Add(prefs);
        }

        prefs.OnApproval = request.OnApproval;
        prefs.OnRejection = request.OnRejection;
        prefs.OnLeaveStatus = request.OnLeaveStatus;
        prefs.OnReminder = request.OnReminder;
        prefs.InAppEnabled = request.InAppEnabled;
        prefs.EmailEnabled = request.EmailEnabled;

        await dbContext.SaveChangesAsync();
        return NoContent();
    }
}

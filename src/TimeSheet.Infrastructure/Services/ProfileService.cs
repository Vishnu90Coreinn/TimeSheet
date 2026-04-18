using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Profile.Queries;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class ProfileService(
    IProfileRepository profileRepository,
    IUnitOfWork unitOfWork,
    IPasswordHasher passwordHasher) : IProfileService
{
    public async Task<MyProfileResult?> GetMyProfileAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await profileRepository.GetProfileAsync(userId, ct);
        return user is null
            ? null
            : new MyProfileResult(
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
                TimeZoneNormalization.NormalizeForClient(user.TimeZoneId));
    }

    public async Task<ProfileUpdateOutcome> UpdateMyProfileAsync(Guid userId, string username, string displayName, string email, string timeZoneId, CancellationToken ct = default)
    {
        var user = await profileRepository.GetTrackedUserAsync(userId, ct);
        if (user is null) return ProfileUpdateOutcome.NotFound;
        if (await profileRepository.ExistsDuplicateIdentityAsync(userId, username.Trim(), email.Trim(), ct)) return ProfileUpdateOutcome.Duplicate;
        if (!TimeZoneNormalization.TryNormalize(timeZoneId, out var normalized)) return ProfileUpdateOutcome.InvalidTimeZone;

        user.Username = username.Trim();
        user.DisplayName = displayName?.Trim() ?? string.Empty;
        user.Email = email.Trim();
        user.TimeZoneId = normalized;
        await unitOfWork.SaveChangesAsync(ct);
        return ProfileUpdateOutcome.Success;
    }

    public async Task<bool> UpdateAvatarAsync(Guid userId, string? avatarDataUrl, CancellationToken ct = default)
    {
        var user = await profileRepository.GetTrackedUserAsync(userId, ct);
        if (user is null) return false;
        user.AvatarDataUrl = avatarDataUrl;
        await unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<PasswordChangeOutcome> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken ct = default)
    {
        var user = await profileRepository.GetTrackedUserAsync(userId, ct);
        if (user is null) return PasswordChangeOutcome.NotFound;
        if (!passwordHasher.Verify(currentPassword, user.PasswordHash)) return PasswordChangeOutcome.InvalidCurrentPassword;
        user.PasswordHash = passwordHasher.Hash(newPassword);
        user.MustChangePasswordOnLogin = false;
        await unitOfWork.SaveChangesAsync(ct);
        return PasswordChangeOutcome.Success;
    }

    public async Task<NotificationPreferencesResult> GetNotificationPreferencesAsync(Guid userId, CancellationToken ct = default)
    {
        var prefs = await profileRepository.GetNotificationPreferencesAsync(userId, ct);
        return prefs is null
            ? new NotificationPreferencesResult(true, true, true, true, true, false)
            : new NotificationPreferencesResult(prefs.OnApproval, prefs.OnRejection, prefs.OnLeaveStatus, prefs.OnReminder, prefs.InAppEnabled, prefs.EmailEnabled);
    }

    public async Task UpdateNotificationPreferencesAsync(Guid userId, NotificationPreferencesResult preferences, CancellationToken ct = default)
    {
        var prefs = await profileRepository.GetNotificationPreferencesAsync(userId, ct);
        if (prefs is null)
        {
            prefs = new UserNotificationPreferences { UserId = userId };
            profileRepository.AddNotificationPreferences(prefs);
        }

        prefs.OnApproval = preferences.OnApproval;
        prefs.OnRejection = preferences.OnRejection;
        prefs.OnLeaveStatus = preferences.OnLeaveStatus;
        prefs.OnReminder = preferences.OnReminder;
        prefs.InAppEnabled = preferences.InAppEnabled;
        prefs.EmailEnabled = preferences.EmailEnabled;
        await unitOfWork.SaveChangesAsync(ct);
    }
}

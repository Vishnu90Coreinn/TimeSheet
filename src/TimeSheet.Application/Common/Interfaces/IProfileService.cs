using TimeSheet.Application.Profile.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface IProfileService
{
    Task<MyProfileResult?> GetMyProfileAsync(Guid userId, CancellationToken ct = default);
    Task<ProfileUpdateOutcome> UpdateMyProfileAsync(Guid userId, string username, string displayName, string email, string timeZoneId, CancellationToken ct = default);
    Task<bool> UpdateAvatarAsync(Guid userId, string? avatarDataUrl, CancellationToken ct = default);
    Task<PasswordChangeOutcome> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken ct = default);
    Task<NotificationPreferencesResult> GetNotificationPreferencesAsync(Guid userId, CancellationToken ct = default);
    Task UpdateNotificationPreferencesAsync(Guid userId, NotificationPreferencesResult preferences, CancellationToken ct = default);
}

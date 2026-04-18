using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IProfileRepository
{
    Task<User?> GetProfileAsync(Guid userId, CancellationToken ct = default);
    Task<User?> GetTrackedUserAsync(Guid userId, CancellationToken ct = default);
    Task<bool> ExistsDuplicateIdentityAsync(Guid userId, string username, string email, CancellationToken ct = default);
    Task<UserNotificationPreferences?> GetNotificationPreferencesAsync(Guid userId, CancellationToken ct = default);
    void AddNotificationPreferences(UserNotificationPreferences preferences);
}

using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class ProfileRepository(TimeSheetDbContext context) : IProfileRepository
{
    public async Task<User?> GetProfileAsync(Guid userId, CancellationToken ct = default)
        => await context.Users.AsNoTracking()
            .Include(u => u.Department)
            .Include(u => u.WorkPolicy)
            .Include(u => u.LeavePolicy)
            .Include(u => u.Manager)
            .SingleOrDefaultAsync(u => u.Id == userId, ct);

    public async Task<User?> GetTrackedUserAsync(Guid userId, CancellationToken ct = default)
        => await context.Users.SingleOrDefaultAsync(u => u.Id == userId, ct);

    public async Task<bool> ExistsDuplicateIdentityAsync(Guid userId, string username, string email, CancellationToken ct = default)
        => await context.Users.AnyAsync(u => u.Id != userId && (u.Username == username || u.Email == email), ct);

    public async Task<UserNotificationPreferences?> GetNotificationPreferencesAsync(Guid userId, CancellationToken ct = default)
        => await context.UserNotificationPreferences.SingleOrDefaultAsync(p => p.UserId == userId, ct);

    public void AddNotificationPreferences(UserNotificationPreferences preferences)
        => context.UserNotificationPreferences.Add(preferences);
}

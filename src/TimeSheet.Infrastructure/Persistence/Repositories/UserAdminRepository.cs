using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class UserAdminRepository(TimeSheetDbContext context) : IUserAdminRepository
{
    public async Task<User?> GetByIdWithDetailsAsync(Guid userId, CancellationToken ct = default)
        => await context.Users.AsNoTracking()
            .Include(u => u.Department)
            .Include(u => u.WorkPolicy)
            .Include(u => u.LeavePolicy)
            .Include(u => u.Manager)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

    public async Task<User?> GetByIdWithRolesAsync(Guid userId, CancellationToken ct = default)
        => await context.Users
            .Include(u => u.UserRoles)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

    public async Task<bool> ExistsDuplicateAsync(string username, string email, string employeeId, Guid? excludeUserId = null, CancellationToken ct = default)
        => await context.Users.AnyAsync(u =>
            (!excludeUserId.HasValue || u.Id != excludeUserId.Value) &&
            (u.Username == username || u.Email == email || u.EmployeeId == employeeId), ct);

    public async Task<bool> ExistsAsync(Guid userId, CancellationToken ct = default)
        => await context.Users.AnyAsync(u => u.Id == userId, ct);

    public async Task<IReadOnlyList<User>> GetReporteesAsync(Guid managerId, CancellationToken ct = default)
        => await context.Users.AsNoTracking()
            .Where(u => u.ManagerId == managerId)
            .OrderBy(u => u.Username)
            .ToListAsync(ct);

    public void Add(User user) => context.Users.Add(user);

    public void SyncRole(User user, Guid roleId)
    {
        context.UserRoles.RemoveRange(user.UserRoles);
        user.UserRoles.Clear();
        var userRole = new UserRole { UserId = user.Id, RoleId = roleId };
        context.UserRoles.Add(userRole);
        user.UserRoles.Add(userRole);
    }
}

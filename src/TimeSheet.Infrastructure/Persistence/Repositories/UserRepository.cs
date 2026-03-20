using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class UserRepository(TimeSheetDbContext context) : IUserRepository
{
    private readonly DbSet<User> _dbSet = context.Set<User>();

    public async Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(u => u.Id == id, ct);

    public async Task<User?> GetByUsernameOrEmailAsync(string identifier, CancellationToken ct = default)
        => await _dbSet
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(
                u => u.Username == identifier || u.Email == identifier, ct);

    public async Task<IReadOnlyList<User>> GetDirectReportsAsync(Guid managerId, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Where(u => u.ManagerId == managerId && u.IsActive)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<User>> GetActiveUsersAsync(CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Where(u => u.IsActive)
            .ToListAsync(ct);

    public void Add(User user) => _dbSet.Add(user);

    public void Update(User user) => _dbSet.Update(user);

    public async Task<User?> GetWithDetailsAsync(Guid id, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Include(u => u.Department)
            .Include(u => u.WorkPolicy)
            .Include(u => u.LeavePolicy)
            .Include(u => u.Manager)
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == id, ct);
}

using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class RoleRepository(TimeSheetDbContext context) : IRoleRepository
{
    private readonly DbSet<Role> _dbSet = context.Set<Role>();

    public async Task<IReadOnlyList<Role>> GetAllAsync(CancellationToken ct = default)
        => await _dbSet.AsNoTracking().OrderBy(r => r.Name).ToListAsync(ct);

    public async Task<bool> ExistsAsync(string name, CancellationToken ct = default)
        => await _dbSet.AnyAsync(r => r.Name == name, ct);

    public async Task<Role?> GetByNameAsync(string name, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(r => r.Name == name, ct);

    public void Add(Role role) => _dbSet.Add(role);
}

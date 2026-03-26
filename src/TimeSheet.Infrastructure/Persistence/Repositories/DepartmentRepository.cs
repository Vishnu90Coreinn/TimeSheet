using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class DepartmentRepository(TimeSheetDbContext context) : IDepartmentRepository
{
    private readonly DbSet<Department> _dbSet = context.Set<Department>();

    public async Task<IReadOnlyList<Department>> GetAllAsync(CancellationToken ct = default)
        => await _dbSet.AsNoTracking().OrderBy(d => d.Name).ToListAsync(ct);

    public async Task<bool> ExistsAsync(string name, CancellationToken ct = default)
        => await _dbSet.AnyAsync(d => d.Name == name, ct);

    public void Add(Department department) => _dbSet.Add(department);
}

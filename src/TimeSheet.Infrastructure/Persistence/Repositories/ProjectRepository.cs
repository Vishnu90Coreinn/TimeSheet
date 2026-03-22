using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class ProjectRepository(TimeSheetDbContext context) : IProjectRepository
{
    private readonly DbSet<Project> _dbSet = context.Set<Project>();

    public async Task<Project?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<IReadOnlyList<Project>> GetActiveAsync(CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Where(p => p.IsActive && !p.IsArchived)
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Project>> GetByMemberAsync(Guid userId, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Include(p => p.Members)
            .Where(p => p.Members.Any(m => m.UserId == userId) && p.IsActive && !p.IsArchived)
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

    public void Add(Project project) => _dbSet.Add(project);

    public void Update(Project project) => _dbSet.Update(project);

    public void Remove(Project project) => _dbSet.Remove(project);
}

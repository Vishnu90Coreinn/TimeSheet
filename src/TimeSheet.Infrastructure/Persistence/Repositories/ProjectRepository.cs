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

    public async Task<bool> ExistsAsync(Guid id, CancellationToken ct = default)
        => await _dbSet.AnyAsync(p => p.Id == id, ct);

    public async Task<bool> ExistsByCodeAsync(string code, Guid? excludeId = null, CancellationToken ct = default)
        => await _dbSet.AnyAsync(
            p => p.Code == code && (!excludeId.HasValue || p.Id != excludeId.Value),
            ct);

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

    public async Task<(IReadOnlyList<PagedProjectRow> Items, int TotalCount, int Page)> GetPagedAsync(
        string? search,
        string? status,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _dbSet.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(p => p.Name.Contains(term) || p.Code.Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = status.Trim().ToLowerInvariant() switch
            {
                "active" => query.Where(p => p.IsActive && !p.IsArchived),
                "inactive" => query.Where(p => !p.IsActive && !p.IsArchived),
                "archived" => query.Where(p => p.IsArchived),
                _ => query,
            };
        }

        sortBy = (sortBy ?? "name").Trim().ToLowerInvariant();
        query = sortBy switch
        {
            "code" => descending ? query.OrderByDescending(p => p.Code) : query.OrderBy(p => p.Code),
            "status" => descending
                ? query.OrderByDescending(p => p.IsArchived ? 0 : p.IsActive ? 2 : 1)
                : query.OrderBy(p => p.IsArchived ? 0 : p.IsActive ? 2 : 1),
            "budgetedhours" => descending ? query.OrderByDescending(p => p.BudgetedHours) : query.OrderBy(p => p.BudgetedHours),
            _ => descending ? query.OrderByDescending(p => p.Name) : query.OrderBy(p => p.Name),
        };

        var totalCount = await query.CountAsync(ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        var safePage = page > totalPages ? totalPages : page;

        var items = await query
            .Skip((safePage - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PagedProjectRow(p.Id, p.Name, p.Code, p.IsActive, p.IsArchived, p.BudgetedHours))
            .ToListAsync(ct);

        return (items, totalCount, safePage);
    }

    public void Add(Project project) => _dbSet.Add(project);

    public void Update(Project project) => _dbSet.Update(project);

    public void Remove(Project project) => _dbSet.Remove(project);

    public async Task<IReadOnlyList<Guid>> GetExistingUserIdsAsync(IReadOnlyCollection<Guid> userIds, CancellationToken ct = default)
        => await context.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => u.Id)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ProjectMemberRow>> GetMembersAsync(Guid projectId, CancellationToken ct = default)
        => await context.ProjectMembers
            .AsNoTracking()
            .Where(pm => pm.ProjectId == projectId)
            .Include(pm => pm.User)
            .OrderBy(pm => pm.User.Username)
            .Select(pm => new ProjectMemberRow(pm.UserId, pm.User.Username, pm.User.Email, pm.User.IsActive))
            .ToListAsync(ct);
}

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

    public async Task<(IReadOnlyList<PagedUserRow> Items, int TotalCount, int Page)> GetPagedAsync(
        string? search,
        string? role,
        Guid? departmentId,
        bool? isActive,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _dbSet
            .AsNoTracking()
            .Include(u => u.Department)
            .Include(u => u.WorkPolicy)
            .Include(u => u.LeavePolicy)
            .Include(u => u.Manager)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(u =>
                u.Username.Contains(term) ||
                u.Email.Contains(term) ||
                u.EmployeeId.Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(role))
            query = query.Where(u => u.Role == role.Trim());

        if (departmentId.HasValue)
            query = query.Where(u => u.DepartmentId == departmentId.Value);

        if (isActive.HasValue)
            query = query.Where(u => u.IsActive == isActive.Value);

        sortBy = (sortBy ?? "username").Trim().ToLowerInvariant();
        query = sortBy switch
        {
            "email" => descending ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
            "employeeid" => descending ? query.OrderByDescending(u => u.EmployeeId) : query.OrderBy(u => u.EmployeeId),
            "role" => descending ? query.OrderByDescending(u => u.Role) : query.OrderBy(u => u.Role),
            "isactive" => descending ? query.OrderByDescending(u => u.IsActive) : query.OrderBy(u => u.IsActive),
            "department" => descending
                ? query.OrderByDescending(u => u.Department != null ? u.Department.Name : string.Empty)
                : query.OrderBy(u => u.Department != null ? u.Department.Name : string.Empty),
            _ => descending ? query.OrderByDescending(u => u.Username) : query.OrderBy(u => u.Username),
        };

        var totalCount = await query.CountAsync(ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        var safePage = page > totalPages ? totalPages : page;

        var items = await query
            .Skip((safePage - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new PagedUserRow(
                u.Id,
                u.Username,
                u.Email,
                u.EmployeeId,
                u.Role,
                u.IsActive,
                u.DepartmentId,
                u.Department != null ? u.Department.Name : null,
                u.WorkPolicyId,
                u.WorkPolicy != null ? u.WorkPolicy.Name : null,
                u.LeavePolicyId,
                u.LeavePolicy != null ? u.LeavePolicy.Name : null,
                u.ManagerId,
                u.Manager != null ? u.Manager.Username : null,
                u.OnboardingCompletedAt,
                u.LeaveWorkflowVisitedAt))
            .ToListAsync(ct);

        return (items, totalCount, safePage);
    }

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

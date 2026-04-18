using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IProjectRepository
{
    Task<Project?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);
    Task<bool> ExistsByCodeAsync(string code, Guid? excludeId = null, CancellationToken ct = default);
    Task<IReadOnlyList<Project>> GetActiveAsync(CancellationToken ct = default);
    Task<IReadOnlyList<Project>> GetByMemberAsync(Guid userId, CancellationToken ct = default);
    Task<(IReadOnlyList<PagedProjectRow> Items, int TotalCount, int Page)> GetPagedAsync(
        string? search,
        string? status,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);
    void Add(Project project);
    void Update(Project project);
    void Remove(Project project);
    Task<IReadOnlyList<Guid>> GetExistingUserIdsAsync(IReadOnlyCollection<Guid> userIds, CancellationToken ct = default);
    Task<IReadOnlyList<ProjectMemberRow>> GetMembersAsync(Guid projectId, CancellationToken ct = default);
}

public record PagedProjectRow(
    Guid Id,
    string Name,
    string Code,
    bool IsActive,
    bool IsArchived,
    int BudgetedHours);

public record ProjectMemberRow(Guid UserId, string Username, string Email, bool IsActive);

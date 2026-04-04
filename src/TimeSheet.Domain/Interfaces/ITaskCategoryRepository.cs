using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface ITaskCategoryRepository
{
    Task<IReadOnlyList<TaskCategory>> GetActiveAsync(CancellationToken ct = default);
    Task<IReadOnlyList<TaskCategory>> GetAllAsync(CancellationToken ct = default);
    Task<bool> ExistsAsync(string name, Guid? excludeId = null, CancellationToken ct = default);
    Task<TaskCategory?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<(IReadOnlyList<TaskCategory> Items, int TotalCount, int Page)> GetPagedAsync(
        string? search,
        bool? isActive,
        bool? isBillable,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);
    void Add(TaskCategory category);
    void Remove(TaskCategory category);
}

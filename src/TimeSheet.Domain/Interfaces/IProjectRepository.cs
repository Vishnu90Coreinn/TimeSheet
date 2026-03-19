using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface IProjectRepository
{
    Task<Project?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<Project>> GetActiveAsync(CancellationToken ct = default);
    Task<IReadOnlyList<Project>> GetByMemberAsync(Guid userId, CancellationToken ct = default);
    void Add(Project project);
    void Update(Project project);
    void Remove(Project project);
}

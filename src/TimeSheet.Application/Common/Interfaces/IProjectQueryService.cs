using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Projects.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface IProjectQueryService
{
    Task<PagedResult<ProjectListItemResult>> GetProjectsPageAsync(
        string? search,
        string? status,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<ProjectDetailResult?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<ProjectDetailResult> CreateAsync(string name, string code, bool isActive, int budgetedHours, CancellationToken ct = default);
    Task<bool> UpdateAsync(Guid id, string name, string code, bool isActive, int budgetedHours, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<bool> ArchiveAsync(Guid id, CancellationToken ct = default);
    Task<ProjectMembersUpdateOutcome> SetMembersAsync(Guid id, IReadOnlyCollection<Guid> userIds, CancellationToken ct = default);
    Task<IReadOnlyList<ProjectMemberResult>?> GetMembersAsync(Guid id, CancellationToken ct = default);
}

public record ProjectDetailResult(Guid Id, string Name, string Code, bool IsActive, bool IsArchived, int BudgetedHours);
public record ProjectMemberResult(Guid UserId, string Username, string Email, bool IsActive);
public record ProjectMembersUpdateOutcome(bool ProjectExists, bool AllUsersExist);

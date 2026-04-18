using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Projects.Queries;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class ProjectQueryService(IProjectRepository projectRepository, IUnitOfWork unitOfWork) : IProjectQueryService
{
    public async Task<PagedResult<ProjectListItemResult>> GetProjectsPageAsync(
        string? search,
        string? status,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (rows, totalCount, effectivePage) = await projectRepository.GetPagedAsync(
            search,
            status,
            sortBy,
            descending,
            page,
            pageSize,
            ct);

        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        return new PagedResult<ProjectListItemResult>(
            rows.Select(r => new ProjectListItemResult(r.Id, r.Name, r.Code, r.IsActive, r.IsArchived, r.BudgetedHours)).ToList(),
            effectivePage,
            pageSize,
            totalCount,
            totalPages,
            sortBy,
            descending ? "desc" : "asc");
    }

    public async Task<ProjectDetailResult?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(id, ct);
        return project is null ? null : Map(project);
    }

    public async Task<ProjectDetailResult> CreateAsync(string name, string code, bool isActive, int budgetedHours, CancellationToken ct = default)
    {
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = name.Trim(),
            Code = code.Trim(),
            IsActive = isActive,
            BudgetedHours = budgetedHours
        };

        projectRepository.Add(project);
        await unitOfWork.SaveChangesAsync(ct);
        return Map(project);
    }

    public async Task<bool> UpdateAsync(Guid id, string name, string code, bool isActive, int budgetedHours, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(id, ct);
        if (project is null)
            return false;

        project.Name = name.Trim();
        project.Code = code.Trim();
        project.IsActive = isActive && !project.IsArchived;
        project.BudgetedHours = budgetedHours;
        projectRepository.Update(project);
        await unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(id, ct);
        if (project is null)
            return false;

        projectRepository.Remove(project);
        await unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> ArchiveAsync(Guid id, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(id, ct);
        if (project is null)
            return false;

        project.IsArchived = true;
        project.IsActive = false;
        projectRepository.Update(project);
        await unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<ProjectMembersUpdateOutcome> SetMembersAsync(Guid id, IReadOnlyCollection<Guid> userIds, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(id, ct);
        if (project is null)
            return new ProjectMembersUpdateOutcome(false, false);

        var distinctUserIds = userIds.Distinct().ToList();
        var existingUsers = await projectRepository.GetExistingUserIdsAsync(distinctUserIds, ct);
        if (existingUsers.Count != distinctUserIds.Count)
            return new ProjectMembersUpdateOutcome(true, false);

        project.Members.Clear();
        foreach (var userId in distinctUserIds)
        {
            project.Members.Add(new ProjectMember { ProjectId = project.Id, UserId = userId });
        }

        projectRepository.Update(project);
        await unitOfWork.SaveChangesAsync(ct);
        return new ProjectMembersUpdateOutcome(true, true);
    }

    public async Task<IReadOnlyList<ProjectMemberResult>?> GetMembersAsync(Guid id, CancellationToken ct = default)
    {
        if (!await projectRepository.ExistsAsync(id, ct))
            return null;

        var members = await projectRepository.GetMembersAsync(id, ct);
        return members.Select(m => new ProjectMemberResult(m.UserId, m.Username, m.Email, m.IsActive)).ToList();
    }

    private static ProjectDetailResult Map(Project project)
        => new(project.Id, project.Name, project.Code, project.IsActive, project.IsArchived, project.BudgetedHours);
}

using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.TaskCategories.Models;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Infrastructure.Persistence.Repositories.TaskCategories;

public class TaskCategoryRepository(TimeSheetDbContext dbContext) : ITaskCategoryRepository
{
    public async Task<PagedResult<TaskCategoryResponse>> GetTaskCategoriesAsync(TaskCategoryListQuery query, CancellationToken cancellationToken)
    {
        var categories = dbContext.TaskCategories.AsNoTracking();

        if (!query.FetchAll)
        {
            if (!query.IncludeInactive)
            {
                categories = categories.Where(c => c.IsActive);
            }

            if (!string.IsNullOrWhiteSpace(query.Name))
            {
                categories = categories.Where(c => c.Name.Contains(query.Name.Trim()));
            }
        }

        var isAscending = !string.Equals(query.SortDirection, "desc", StringComparison.OrdinalIgnoreCase);
        categories = isAscending ? categories.OrderBy(c => c.Name) : categories.OrderByDescending(c => c.Name);

        var totalCount = await categories.CountAsync(cancellationToken);
        if (!query.FetchAll)
        {
            categories = categories.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize);
        }

        var items = await categories.Select(c => new TaskCategoryResponse(c.Id, c.Name, c.IsActive, c.IsBillable)).ToListAsync(cancellationToken);
        return new PagedResult<TaskCategoryResponse>(items, totalCount, query.FetchAll ? 1 : query.PageNumber, query.FetchAll ? totalCount : query.PageSize, query.FetchAll);
    }

    public Task<bool> ExistsByNameAsync(string name, Guid? excludingId, CancellationToken cancellationToken)
    {
        var categories = dbContext.TaskCategories.AsQueryable().Where(c => c.Name == name);
        if (excludingId.HasValue)
        {
            categories = categories.Where(c => c.Id != excludingId.Value);
        }

        return categories.AnyAsync(cancellationToken);
    }

    public void Add(TaskCategory category) => dbContext.TaskCategories.Add(category);

    public Task<TaskCategory?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
        => dbContext.TaskCategories.SingleOrDefaultAsync(c => c.Id == id, cancellationToken);

    public void Remove(TaskCategory category) => dbContext.TaskCategories.Remove(category);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => dbContext.SaveChangesAsync(cancellationToken);
}

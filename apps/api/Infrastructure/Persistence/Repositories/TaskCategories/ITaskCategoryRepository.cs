using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.TaskCategories.Models;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Infrastructure.Persistence.Repositories.TaskCategories;

public interface ITaskCategoryRepository
{
    Task<PagedResult<TaskCategoryResponse>> GetTaskCategoriesAsync(TaskCategoryListQuery query, CancellationToken cancellationToken);
    Task<bool> ExistsByNameAsync(string name, Guid? excludingId, CancellationToken cancellationToken);
    void Add(TaskCategory category);
    Task<TaskCategory?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    void Remove(TaskCategory category);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

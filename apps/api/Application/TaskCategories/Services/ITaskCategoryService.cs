using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.TaskCategories.Models;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.TaskCategories.Services;

public interface ITaskCategoryService
{
    Task<(PagedResult<TaskCategoryResponse>? Data, OperationError? Error)> GetCategoriesAsync(TaskCategoryListQuery query, CancellationToken cancellationToken);
    Task<(TaskCategoryResponse? Data, OperationError? Error)> CreateAsync(UpsertTaskCategoryRequest request, CancellationToken cancellationToken);
    Task<OperationError?> UpdateAsync(Guid id, UpsertTaskCategoryRequest request, CancellationToken cancellationToken);
    Task<OperationError?> DeleteAsync(Guid id, CancellationToken cancellationToken);
}

using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.TaskCategories.Models;
using TimeSheet.Api.Application.TaskCategories.Services;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.TaskCategories.Handlers;

public interface IGetTaskCategoriesHandler
{
    Task<(PagedResult<TaskCategoryResponse>? Data, OperationError? Error)> HandleAsync(TaskCategoryListQuery query, CancellationToken cancellationToken);
}
public class GetTaskCategoriesHandler(ITaskCategoryService service) : IGetTaskCategoriesHandler
{
    public Task<(PagedResult<TaskCategoryResponse>? Data, OperationError? Error)> HandleAsync(TaskCategoryListQuery query, CancellationToken cancellationToken) =>
        service.GetCategoriesAsync(query, cancellationToken);
}

public interface ICreateTaskCategoryHandler
{
    Task<(TaskCategoryResponse? Data, OperationError? Error)> HandleAsync(UpsertTaskCategoryRequest request, CancellationToken cancellationToken);
}
public class CreateTaskCategoryHandler(ITaskCategoryService service) : ICreateTaskCategoryHandler
{
    public Task<(TaskCategoryResponse? Data, OperationError? Error)> HandleAsync(UpsertTaskCategoryRequest request, CancellationToken cancellationToken) =>
        service.CreateAsync(request, cancellationToken);
}

public interface IUpdateTaskCategoryHandler
{
    Task<OperationError?> HandleAsync(Guid id, UpsertTaskCategoryRequest request, CancellationToken cancellationToken);
}
public class UpdateTaskCategoryHandler(ITaskCategoryService service) : IUpdateTaskCategoryHandler
{
    public Task<OperationError?> HandleAsync(Guid id, UpsertTaskCategoryRequest request, CancellationToken cancellationToken) =>
        service.UpdateAsync(id, request, cancellationToken);
}

public interface IDeleteTaskCategoryHandler
{
    Task<OperationError?> HandleAsync(Guid id, CancellationToken cancellationToken);
}
public class DeleteTaskCategoryHandler(ITaskCategoryService service) : IDeleteTaskCategoryHandler
{
    public Task<OperationError?> HandleAsync(Guid id, CancellationToken cancellationToken) =>
        service.DeleteAsync(id, cancellationToken);
}

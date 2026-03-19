using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.TaskCategories.Models;
using TimeSheet.Api.Application.TaskCategories.Validators;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Infrastructure.Persistence.Repositories.TaskCategories;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Application.TaskCategories.Services;

public class TaskCategoryService(
    ITaskCategoryRepository repository,
    ITaskCategoryQueryValidator queryValidator,
    ITaskCategoryRequestValidator requestValidator) : ITaskCategoryService
{
    public async Task<(PagedResult<TaskCategoryResponse>? Data, OperationError? Error)> GetCategoriesAsync(TaskCategoryListQuery query, CancellationToken cancellationToken)
    {
        var error = queryValidator.Validate(query);
        if (error is not null) return (null, error);

        var data = await repository.GetTaskCategoriesAsync(query, cancellationToken);
        return (data, null);
    }

    public async Task<(TaskCategoryResponse? Data, OperationError? Error)> CreateAsync(UpsertTaskCategoryRequest request, CancellationToken cancellationToken)
    {
        var error = requestValidator.Validate(request);
        if (error is not null) return (null, error);

        var name = request.Name.Trim();
        if (await repository.ExistsByNameAsync(name, null, cancellationToken))
        {
            return (null, new OperationError(ErrorCodes.TaskCategoryAlreadyExists, ApiMessages.TaskCategoryAlreadyExists, StatusCodes.Status409Conflict));
        }

        var category = new TaskCategory
        {
            Id = Guid.NewGuid(),
            Name = name,
            IsActive = request.IsActive,
            IsBillable = request.IsBillable
        };
        repository.Add(category);
        await repository.SaveChangesAsync(cancellationToken);
        return (new TaskCategoryResponse(category.Id, category.Name, category.IsActive, category.IsBillable), null);
    }

    public async Task<OperationError?> UpdateAsync(Guid id, UpsertTaskCategoryRequest request, CancellationToken cancellationToken)
    {
        var error = requestValidator.Validate(request);
        if (error is not null) return error;

        var category = await repository.GetByIdAsync(id, cancellationToken);
        if (category is null)
        {
            return new OperationError(ErrorCodes.TaskCategoryNotFound, ApiMessages.TaskCategoryNotFound, StatusCodes.Status404NotFound);
        }

        var name = request.Name.Trim();
        if (await repository.ExistsByNameAsync(name, id, cancellationToken))
        {
            return new OperationError(ErrorCodes.TaskCategoryAlreadyExists, ApiMessages.TaskCategoryAlreadyExists, StatusCodes.Status409Conflict);
        }

        category.Name = name;
        category.IsActive = request.IsActive;
        category.IsBillable = request.IsBillable;
        await repository.SaveChangesAsync(cancellationToken);
        return null;
    }

    public async Task<OperationError?> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var category = await repository.GetByIdAsync(id, cancellationToken);
        if (category is null)
        {
            return new OperationError(ErrorCodes.TaskCategoryNotFound, ApiMessages.TaskCategoryNotFound, StatusCodes.Status404NotFound);
        }

        repository.Remove(category);
        await repository.SaveChangesAsync(cancellationToken);
        return null;
    }
}

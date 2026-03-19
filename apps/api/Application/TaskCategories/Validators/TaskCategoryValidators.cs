using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.TaskCategories.Models;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.TaskCategories.Validators;

public interface ITaskCategoryQueryValidator
{
    OperationError? Validate(TaskCategoryListQuery query);
}

public class TaskCategoryQueryValidator : ITaskCategoryQueryValidator
{
    public OperationError? Validate(TaskCategoryListQuery query)
    {
        if (query.PageNumber <= 0) return new OperationError("VALIDATION_PAGE_NUMBER", ValidationMessages.PageNumberMustBePositive, StatusCodes.Status400BadRequest);
        if (query.PageSize <= 0) return new OperationError("VALIDATION_PAGE_SIZE", ValidationMessages.PageSizeMustBePositive, StatusCodes.Status400BadRequest);
        return null;
    }
}

public interface ITaskCategoryRequestValidator
{
    OperationError? Validate(UpsertTaskCategoryRequest request);
}

public class TaskCategoryRequestValidator : ITaskCategoryRequestValidator
{
    public OperationError? Validate(UpsertTaskCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return new OperationError("TASK_CATEGORY_NAME_REQUIRED", ApiMessages.TaskCategoryNameRequired, StatusCodes.Status400BadRequest);
        }

        return null;
    }
}

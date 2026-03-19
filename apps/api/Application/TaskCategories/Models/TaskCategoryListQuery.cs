using TimeSheet.Api.Application.Common.Models;

namespace TimeSheet.Api.Application.TaskCategories.Models;

public class TaskCategoryListQuery : ListQuery
{
    public bool IncludeInactive { get; init; }
    public string? Name { get; init; }
}

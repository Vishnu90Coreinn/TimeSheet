using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Queries;

public class GetTaskCategoriesQueryHandler(ITaskCategoryRepository taskCategoryRepository)
    : IRequestHandler<GetTaskCategoriesQuery, Result<List<TaskCategoryResult>>>
{
    public async Task<Result<List<TaskCategoryResult>>> Handle(GetTaskCategoriesQuery request, CancellationToken cancellationToken)
    {
        var categories = request.AdminAll
            ? await taskCategoryRepository.GetAllAsync(cancellationToken)
            : await taskCategoryRepository.GetActiveAsync(cancellationToken);

        var result = categories
            .OrderBy(c => c.Name)
            .Select(c => new TaskCategoryResult(c.Id, c.Name, c.IsActive, c.IsBillable))
            .ToList();
        return Result<List<TaskCategoryResult>>.Success(result);
    }
}

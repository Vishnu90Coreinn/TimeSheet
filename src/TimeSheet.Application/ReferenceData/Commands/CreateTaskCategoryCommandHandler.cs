using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Commands;

public class CreateTaskCategoryCommandHandler(ITaskCategoryRepository taskCategoryRepository, IUnitOfWork unitOfWork)
    : IRequestHandler<CreateTaskCategoryCommand, Result<TaskCategoryMutationResult>>
{
    public async Task<Result<TaskCategoryMutationResult>> Handle(CreateTaskCategoryCommand request, CancellationToken cancellationToken)
    {
        if (await taskCategoryRepository.ExistsAsync(request.Name, null, cancellationToken))
            return Result<TaskCategoryMutationResult>.Conflict("Task category already exists.");

        var category = new TaskCategory
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            IsActive = request.IsActive,
            IsBillable = request.IsBillable
        };

        taskCategoryRepository.Add(category);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<TaskCategoryMutationResult>.Success(new TaskCategoryMutationResult(category.Id, category.Name, category.IsActive, category.IsBillable));
    }
}

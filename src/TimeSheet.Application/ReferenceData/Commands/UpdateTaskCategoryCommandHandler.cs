using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Commands;

public class UpdateTaskCategoryCommandHandler(ITaskCategoryRepository taskCategoryRepository, IUnitOfWork unitOfWork)
    : IRequestHandler<UpdateTaskCategoryCommand, Result>
{
    public async Task<Result> Handle(UpdateTaskCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = await taskCategoryRepository.GetByIdAsync(request.Id, cancellationToken);
        if (category is null) return Result.NotFound("Task category not found.");

        if (await taskCategoryRepository.ExistsAsync(request.Name, request.Id, cancellationToken))
            return Result.Conflict("Task category already exists.");

        category.Name = request.Name.Trim();
        category.IsActive = request.IsActive;
        category.IsBillable = request.IsBillable;

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

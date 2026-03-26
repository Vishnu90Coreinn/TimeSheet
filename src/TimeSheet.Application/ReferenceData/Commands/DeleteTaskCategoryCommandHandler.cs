using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Commands;

public class DeleteTaskCategoryCommandHandler(ITaskCategoryRepository taskCategoryRepository, IUnitOfWork unitOfWork)
    : IRequestHandler<DeleteTaskCategoryCommand, Result>
{
    public async Task<Result> Handle(DeleteTaskCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = await taskCategoryRepository.GetByIdAsync(request.Id, cancellationToken);
        if (category is null) return Result.NotFound("Task category not found.");

        taskCategoryRepository.Remove(category);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

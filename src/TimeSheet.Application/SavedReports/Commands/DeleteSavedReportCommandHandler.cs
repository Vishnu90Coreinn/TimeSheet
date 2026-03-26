using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.SavedReports.Commands;

public class DeleteSavedReportCommandHandler(
    ISavedReportRepository repo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser)
    : IRequestHandler<DeleteSavedReportCommand, Result>
{
    public async Task<Result> Handle(DeleteSavedReportCommand request, CancellationToken cancellationToken)
    {
        var report = await repo.GetByIdAsync(request.Id, cancellationToken);
        if (report is null) return Result.NotFound("Saved report not found.");
        if (report.UserId != currentUser.UserId && !currentUser.IsAdmin)
            return Result.Forbidden("You cannot delete this report.");

        repo.Remove(report);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

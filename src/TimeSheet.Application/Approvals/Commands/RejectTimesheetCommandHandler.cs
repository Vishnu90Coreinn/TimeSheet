using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Approvals.Commands;

public class RejectTimesheetCommandHandler(
    ITimesheetRepository timesheetRepository,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider)
    : IRequestHandler<RejectTimesheetCommand, Result>
{
    public async Task<Result> Handle(RejectTimesheetCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Comment))
            return Result.Failure("Comment is required for rejection.");

        var timesheet = await timesheetRepository.GetByIdAsync(request.TimesheetId, cancellationToken);
        if (timesheet is null)
            return Result.NotFound("Timesheet not found.");

        if (timesheet.Status != TimesheetStatus.Submitted)
            return Result.Conflict("Only submitted timesheets can be actioned.");

        if (!currentUser.IsAdmin && timesheet.User?.ManagerId != currentUser.UserId)
            return Result.Forbidden("You can only action timesheets for your direct reports.");

        timesheet.Reject(currentUser.UserId, request.Comment);

        timesheetRepository.AddApprovalAction(new ApprovalAction
        {
            Id = Guid.NewGuid(),
            TimesheetId = timesheet.Id,
            ManagerUserId = currentUser.UserId,
            Action = ApprovalActionType.Rejected,
            Comment = request.Comment.Trim(),
            ActionedAtUtc = dateTimeProvider.UtcNow
        });

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

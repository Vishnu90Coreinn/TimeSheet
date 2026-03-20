using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Approvals.Commands;

public class ApproveTimesheetCommandHandler(
    ITimesheetRepository timesheetRepository,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider,
    IAuditService auditService,
    INotificationService notificationService)
    : IRequestHandler<ApproveTimesheetCommand, Result>
{
    public async Task<Result> Handle(ApproveTimesheetCommand request, CancellationToken cancellationToken)
    {
        var timesheet = await timesheetRepository.GetByIdAsync(request.TimesheetId, cancellationToken);
        if (timesheet is null)
            return Result.NotFound("Timesheet not found.");

        if (timesheet.Status != TimesheetStatus.Submitted)
            return Result.Conflict("Only submitted timesheets can be actioned.");

        if (!currentUser.IsAdmin && timesheet.User?.ManagerId != currentUser.UserId)
            return Result.Forbidden("You can only action timesheets for your direct reports.");

        timesheet.Approve(currentUser.UserId);
        timesheet.ManagerComment = request.Comment?.Trim();

        timesheet.ApprovalActions.Add(new ApprovalAction
        {
            Id = Guid.NewGuid(),
            TimesheetId = timesheet.Id,
            ManagerUserId = currentUser.UserId,
            Action = ApprovalActionType.Approved,
            Comment = request.Comment?.Trim() ?? string.Empty,
            ActionedAtUtc = dateTimeProvider.UtcNow
        });

        await auditService.WriteAsync(
            "TimesheetApproved",
            "Timesheet",
            request.TimesheetId.ToString(),
            $"Approved by {currentUser.UserId}",
            currentUser.UserId);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        await notificationService.CreateAsync(
            timesheet.UserId,
            "Timesheet Approved",
            $"Your timesheet for {timesheet.WorkDate:yyyy-MM-dd} has been approved.",
            NotificationType.StatusChange);

        return Result.Success();
    }
}

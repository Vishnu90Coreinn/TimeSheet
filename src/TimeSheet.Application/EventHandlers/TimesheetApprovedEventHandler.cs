using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Events;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.EventHandlers;

public class TimesheetApprovedEventHandler(IAuditService audit, INotificationService notification, IUnitOfWork unitOfWork)
    : INotificationHandler<TimesheetApprovedEvent>
{
    public async Task Handle(TimesheetApprovedEvent evt, CancellationToken ct)
    {
        await audit.WriteAsync("TimesheetApproved", "Timesheet", evt.TimesheetId.ToString(),
            $"Approved for {evt.WorkDate:yyyy-MM-dd}", evt.ApproverId);
        await notification.CreateAsync(evt.UserId, "Timesheet Approved",
            $"Your timesheet for {evt.WorkDate:yyyy-MM-dd} has been approved.",
            NotificationType.StatusChange);
        await unitOfWork.SaveChangesAsync(ct);
    }
}

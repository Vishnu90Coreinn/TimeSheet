using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Events;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.EventHandlers;

public class TimesheetRejectedEventHandler(IAuditService audit, INotificationService notification, IUnitOfWork unitOfWork)
    : INotificationHandler<TimesheetRejectedEvent>
{
    public async Task Handle(TimesheetRejectedEvent evt, CancellationToken ct)
    {
        await audit.WriteAsync("TimesheetRejected", "Timesheet", evt.TimesheetId.ToString(),
            $"Rejected for {evt.WorkDate:yyyy-MM-dd}", evt.ApproverId);
        await notification.CreateAsync(evt.UserId, "Timesheet Rejected",
            $"Your timesheet for {evt.WorkDate:yyyy-MM-dd} has been rejected. {evt.Comment}",
            NotificationType.StatusChange);
        await unitOfWork.SaveChangesAsync(ct);
    }
}

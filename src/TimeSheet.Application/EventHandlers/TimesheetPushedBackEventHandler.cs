using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Events;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.EventHandlers;

public class TimesheetPushedBackEventHandler(IAuditService audit, INotificationService notification, IUnitOfWork unitOfWork)
    : INotificationHandler<TimesheetPushedBackEvent>
{
    public async Task Handle(TimesheetPushedBackEvent evt, CancellationToken ct)
    {
        await audit.WriteAsync("TimesheetPushedBack", "Timesheet", evt.TimesheetId.ToString(),
            $"Pushed back for {evt.WorkDate:yyyy-MM-dd}", evt.ApproverId);
        await notification.CreateAsync(evt.UserId, "Timesheet Pushed Back",
            $"Your timesheet for {evt.WorkDate:yyyy-MM-dd} has been pushed back for revision.",
            NotificationType.StatusChange);
        await unitOfWork.SaveChangesAsync(ct);
    }
}

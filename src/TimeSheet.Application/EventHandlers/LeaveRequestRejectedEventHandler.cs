using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Events;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.EventHandlers;

public class LeaveRequestRejectedEventHandler(IAuditService audit, INotificationService notification, IUnitOfWork unitOfWork)
    : INotificationHandler<LeaveRequestRejectedEvent>
{
    public async Task Handle(LeaveRequestRejectedEvent evt, CancellationToken ct)
    {
        await audit.WriteAsync("LeaveRequestRejected", "LeaveRequest", evt.LeaveRequestId.ToString(),
            $"Rejected for {evt.LeaveDate:yyyy-MM-dd}", evt.ApproverId);
        await notification.CreateAsync(evt.UserId, "Leave Request Rejected",
            $"Your leave request for {evt.LeaveDate:MMM d} has been rejected.",
            NotificationType.StatusChange);
        await unitOfWork.SaveChangesAsync(ct);
    }
}

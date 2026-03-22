using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Events;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.EventHandlers;

public class LeaveRequestApprovedEventHandler(IAuditService audit, INotificationService notification, IUnitOfWork unitOfWork)
    : INotificationHandler<LeaveRequestApprovedEvent>
{
    public async Task Handle(LeaveRequestApprovedEvent evt, CancellationToken ct)
    {
        await audit.WriteAsync("LeaveRequestApproved", "LeaveRequest", evt.LeaveRequestId.ToString(),
            $"Approved for {evt.LeaveDate:yyyy-MM-dd}", evt.ApproverId);
        await notification.CreateAsync(evt.UserId, "Leave Request Approved",
            $"Your leave request for {evt.LeaveDate:MMM d} has been approved.",
            NotificationType.StatusChange);
        await unitOfWork.SaveChangesAsync(ct);
    }
}

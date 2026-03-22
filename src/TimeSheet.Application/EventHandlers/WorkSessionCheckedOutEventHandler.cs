using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Events;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.EventHandlers;

public class WorkSessionCheckedOutEventHandler(IAuditService audit, IUnitOfWork unitOfWork)
    : INotificationHandler<WorkSessionCheckedOutEvent>
{
    public async Task Handle(WorkSessionCheckedOutEvent evt, CancellationToken ct)
    {
        await audit.WriteAsync("WorkSessionCheckedOut", "WorkSession", evt.WorkSessionId.ToString(),
            $"Checked out at {evt.CheckedOutAtUtc:HH:mm} UTC", evt.UserId);
        await unitOfWork.SaveChangesAsync(ct);
    }
}

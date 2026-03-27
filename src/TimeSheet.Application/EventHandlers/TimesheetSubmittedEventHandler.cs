using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Events;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.EventHandlers;

public class TimesheetSubmittedEventHandler(IAuditService audit, INotificationService notification, IUserRepository users)
    : INotificationHandler<TimesheetSubmittedEvent>
{
    public async Task Handle(TimesheetSubmittedEvent evt, CancellationToken ct)
    {
        await audit.WriteAsync("TimesheetSubmitted", "Timesheet", evt.TimesheetId.ToString(),
            $"Submitted for {evt.WorkDate:yyyy-MM-dd}", evt.UserId);

        await notification.CreateAsync(
            evt.UserId,
            "Timesheet Submitted",
            $"Your timesheet for {evt.WorkDate:yyyy-MM-dd} has been submitted for review.",
            NotificationType.StatusChange,
            groupKey: "timesheet-status",
            actionUrl: "/timesheets");

        var employee = await users.GetByIdAsync(evt.UserId, ct);
        if (employee?.ManagerId is Guid managerId)
        {
            var employeeName = string.IsNullOrWhiteSpace(employee.DisplayName)
                ? employee.Username
                : employee.DisplayName;

            await notification.CreateAsync(
                managerId,
                "Timesheet Pending Approval",
                $"{employeeName} submitted timesheet for {evt.WorkDate:yyyy-MM-dd}.",
                NotificationType.PendingApproval,
                groupKey: "timesheet-approval",
                actionUrl: "/approvals");
        }
    }
}

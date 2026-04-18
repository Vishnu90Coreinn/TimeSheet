using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace TimeSheet.Api.Hubs;

[Authorize]
public class TimeSheetHub : Hub
{
    // Server → Client messages (documented as constants for the frontend to match)
    public const string TimesheetStatusChanged = "TimesheetStatusChanged";
    public const string TimesheetSubmitted      = "TimesheetSubmitted";
    public const string LeaveStatusChanged      = "LeaveStatusChanged";
    public const string TeamClockIn             = "TeamClockIn";
    public const string NewNotification         = "NewNotification";
    public const string DashboardUpdated        = "DashboardUpdated";

    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");
        await base.OnConnectedAsync();
    }

    // Client calls this to join a manager group so they receive team events
    public async Task JoinManagerGroup(string managerId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"manager-{managerId}");
    }

    public async Task LeaveManagerGroup(string managerId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"manager-{managerId}");
    }
}

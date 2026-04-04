using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Manager.Queries;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class ManagerQueryService(IManagerRepository managerRepository, INotificationService notificationService) : IManagerQueryService
{
    public async Task<PagedResult<TeamMemberStatusResult>> GetTeamStatusPageAsync(
        Guid managerId,
        DateOnly date,
        string? search,
        string? attendance,
        string? timesheetStatus,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (rows, totalCount, effectivePage) = await managerRepository.GetTeamStatusPageAsync(
            managerId,
            date,
            search,
            attendance,
            timesheetStatus,
            sortBy,
            descending,
            page,
            pageSize,
            ct);

        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        return new PagedResult<TeamMemberStatusResult>(
            rows.Select(r => new TeamMemberStatusResult(
                r.UserId,
                r.Username,
                r.DisplayName,
                r.AvatarDataUrl,
                r.Attendance,
                r.CheckInAtUtc,
                r.CheckOutAtUtc,
                r.WeekLoggedMinutes,
                r.WeekExpectedMinutes,
                r.TodayTimesheetStatus,
                r.PendingApprovalCount)).ToList(),
            effectivePage,
            pageSize,
            totalCount,
            totalPages,
            sortBy,
            descending ? "desc" : "asc");
    }

    public async Task<bool> SendReminderAsync(Guid managerId, Guid userId, CancellationToken ct = default)
    {
        if (!await managerRepository.IsDirectReportAsync(managerId, userId, ct))
            return false;

        await notificationService.CreateAsync(
            userId,
            "Timesheet Reminder",
            "Your manager has sent a reminder to submit your timesheet.",
            NotificationType.MissingTimesheet);
        return true;
    }
}

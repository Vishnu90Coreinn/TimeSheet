using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Manager.Queries;

public record GetTeamStatusPageQuery(
    DateOnly Date,
    string? Search,
    string? Attendance,
    string? TimesheetStatus,
    string SortBy,
    bool Descending,
    int Page,
    int PageSize) : IRequest<Result<PagedResult<TeamMemberStatusResult>>>;

public record TeamMemberStatusResult(
    Guid UserId,
    string Username,
    string DisplayName,
    string? AvatarDataUrl,
    string Attendance,
    string? CheckInAtUtc,
    string? CheckOutAtUtc,
    int WeekLoggedMinutes,
    int WeekExpectedMinutes,
    string TodayTimesheetStatus,
    int PendingApprovalCount);

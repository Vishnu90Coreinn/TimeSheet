using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Queries;

public record GetPendingTimesheetsQuery(
    string? Search,
    bool? HasMismatch,
    string SortBy,
    bool Descending,
    int Page,
    int PageSize) : IRequest<Result<PagedResult<PendingTimesheetItem>>>;

public record PendingTimesheetItem(
    Guid TimesheetId,
    Guid UserId,
    string Username,
    string DisplayName,
    DateOnly WorkDate,
    int EnteredMinutes,
    string Status,
    DateTime? SubmittedAtUtc,
    bool HasMismatch,
    string? MismatchReason,
    string? DelegatedFromUsername = null);

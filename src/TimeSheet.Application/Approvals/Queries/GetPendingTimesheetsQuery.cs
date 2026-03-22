using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Queries;

public record GetPendingTimesheetsQuery : IRequest<Result<List<PendingTimesheetItem>>>;

public record PendingTimesheetItem(
    Guid TimesheetId,
    Guid UserId,
    string Username,
    DateOnly WorkDate,
    int EnteredMinutes,
    string Status,
    DateTime? SubmittedAtUtc,
    bool HasMismatch,
    string? MismatchReason);

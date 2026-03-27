using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Approvals.Queries;

public record GetPendingTimesheetDetailQuery(Guid TimesheetId) : IRequest<Result<PendingTimesheetDetailResult>>;

public record PendingTimesheetDetailResult(
    Guid TimesheetId,
    Guid UserId,
    string Username,
    string DisplayName,
    DateOnly WorkDate,
    string Status,
    int EnteredMinutes,
    string? MismatchReason,
    DateTime? SubmittedAtUtc,
    IReadOnlyList<PendingTimesheetDetailEntryResult> Entries);

public record PendingTimesheetDetailEntryResult(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    Guid TaskCategoryId,
    string TaskCategoryName,
    int Minutes,
    string? Notes);

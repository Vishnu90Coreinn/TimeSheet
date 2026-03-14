using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record TimesheetApprovalListItem(
    Guid TimesheetId,
    Guid UserId,
    string Username,
    DateOnly WorkDate,
    int EnteredMinutes,
    string Status,
    DateTime? SubmittedAtUtc,
    bool HasMismatch,
    string? MismatchReason);

public record TimesheetDecisionRequest([MaxLength(1000)] string? Comment);

public record ApprovalActionResponse(
    Guid Id,
    Guid TimesheetId,
    Guid ManagerUserId,
    string ManagerUsername,
    string Action,
    string Comment,
    DateTime ActionedAtUtc);

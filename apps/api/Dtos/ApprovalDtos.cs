using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record TimesheetApprovalListItem(
    Guid TimesheetId,
    Guid UserId,
    string Username,
    string DisplayName,
    DateOnly WorkDate,
    int EnteredMinutes,
    string Status,
    DateTime? SubmittedAtUtc,
    bool HasMismatch,
    string? MismatchReason);

public record TimesheetDecisionRequest([MaxLength(1000)] string? Comment);

public record CreateDelegationRequest(Guid ToUserId, DateOnly FromDate, DateOnly ToDate);

public record ApprovalActionResponse(
    Guid Id,
    Guid TimesheetId,
    Guid ManagerUserId,
    string ManagerUsername,
    string Action,
    string Comment,
    DateTime ActionedAtUtc);

public record PendingTimesheetDetailResponse(
    Guid TimesheetId,
    Guid UserId,
    string Username,
    string DisplayName,
    DateOnly WorkDate,
    string Status,
    int EnteredMinutes,
    string? MismatchReason,
    DateTime? SubmittedAtUtc,
    IReadOnlyList<PendingTimesheetDetailEntryResponse> Entries);

public record PendingTimesheetDetailEntryResponse(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    Guid TaskCategoryId,
    string TaskCategoryName,
    int Minutes,
    string? Notes);

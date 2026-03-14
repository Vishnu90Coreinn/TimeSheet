using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record LeaveTypeResponse(Guid Id, string Name, bool IsActive);
public record UpsertLeaveTypeRequest([Required][MaxLength(120)] string Name, bool IsActive);

public record ApplyLeaveRequest(
    DateOnly LeaveDate,
    [Required] Guid LeaveTypeId,
    bool IsHalfDay,
    [MaxLength(1000)] string? Comment
);
public record ReviewLeaveRequest(bool Approve, [MaxLength(1000)] string? Comment);

public record LeaveRequestResponse(
    Guid Id,
    Guid UserId,
    string Username,
    DateOnly LeaveDate,
    Guid LeaveTypeId,
    string LeaveTypeName,
    bool IsHalfDay,
    string Status,
    string? Comment,
    Guid? ReviewedByUserId,
    string? ReviewedByUsername,
    string? ReviewerComment,
    DateTime CreatedAtUtc,
    DateTime? ReviewedAtUtc);

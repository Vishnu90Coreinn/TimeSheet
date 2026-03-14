namespace TimeSheet.Api.Dtos;

public record LeaveTypeResponse(Guid Id, string Name, bool IsActive);
public record UpsertLeaveTypeRequest(string Name, bool IsActive);

public record ApplyLeaveRequest(DateOnly LeaveDate, Guid LeaveTypeId, bool IsHalfDay, string? Comment);
public record ReviewLeaveRequest(bool Approve, string? Comment);

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

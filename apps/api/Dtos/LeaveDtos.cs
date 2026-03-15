using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record LeaveTypeResponse(Guid Id, string Name, bool IsActive);
public record UpsertLeaveTypeRequest([Required][MaxLength(120)] string Name, bool IsActive);

public record ApplyLeaveRequest(
    [Required] DateOnly FromDate,
    [Required] DateOnly ToDate,
    [Required] Guid LeaveTypeId,
    bool IsHalfDay,
    [MaxLength(1000)] string? Comment);
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

// ── Leave Policy ──────────────────────────────────────────────
public record LeavePolicyAllocationRequest(
    [Required] Guid LeaveTypeId,
    [Range(0, 365)] int DaysPerYear);

public record UpsertLeavePolicyRequest(
    [Required][MaxLength(120)] string Name,
    bool IsActive,
    [Required] List<LeavePolicyAllocationRequest> Allocations);

public record LeavePolicyAllocationResponse(Guid LeaveTypeId, string LeaveTypeName, int DaysPerYear);

public record LeavePolicyResponse(
    Guid Id,
    string Name,
    bool IsActive,
    List<LeavePolicyAllocationResponse> Allocations);

// ── Leave Balance ─────────────────────────────────────────────
public record LeaveBalanceResponse(
    Guid LeaveTypeId,
    string LeaveTypeName,
    int TotalDays,
    int UsedDays,
    int RemainingDays);

public record AdjustLeaveBalanceRequest(
    [Range(-365, 365)] int Adjustment,
    [MaxLength(500)] string? Note);

// ── Grouped Leave History ─────────────────────────────────────
public record LeaveRequestGroupResponse(
    Guid GroupId,
    string LeaveTypeName,
    DateOnly FromDate,
    DateOnly ToDate,
    int Days,
    string Status,
    DateOnly AppliedOnDate,
    string? ApprovedByUsername,
    string? Comment);

// ── Calendar ──────────────────────────────────────────────────
public record LeaveCalendarDay(DateOnly Date, string Type);

// ── Team on Leave ─────────────────────────────────────────────
public record TeamLeaveEntryResponse(
    Guid UserId,
    string Username,
    DateOnly FromDate,
    DateOnly ToDate,
    string LeaveTypeName,
    string Status);

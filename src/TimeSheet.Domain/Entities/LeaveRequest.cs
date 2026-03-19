using TimeSheet.Domain.Common;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Events;
using TimeSheet.Domain.Exceptions;

namespace TimeSheet.Domain.Entities;

public class LeaveRequest : Entity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid LeaveTypeId { get; set; }
    public LeaveType LeaveType { get; set; } = null!;
    public DateOnly LeaveDate { get; set; }
    public bool IsHalfDay { get; set; }
    public LeaveRequestStatus Status { get; set; } = LeaveRequestStatus.Pending;
    public string? Comment { get; set; }
    public Guid? ReviewedByUserId { get; set; }
    public User? ReviewedByUser { get; set; }
    public string? ReviewerComment { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAtUtc { get; set; }
    public Guid? LeaveGroupId { get; set; }  // groups multi-day requests from one submission

    public void Approve(Guid approverId)
    {
        if (Status != LeaveRequestStatus.Pending)
            throw new InvalidStateTransitionException(nameof(LeaveRequest), Status.ToString(), nameof(Approve));

        Status = LeaveRequestStatus.Approved;
        ReviewedByUserId = approverId;
        ReviewedAtUtc = DateTime.UtcNow;
        AddDomainEvent(new LeaveRequestApprovedEvent(Id, UserId, approverId, LeaveDate, LeaveGroupId));
    }

    public void Reject(Guid approverId, string comment)
    {
        if (Status != LeaveRequestStatus.Pending)
            throw new InvalidStateTransitionException(nameof(LeaveRequest), Status.ToString(), nameof(Reject));

        Status = LeaveRequestStatus.Rejected;
        ReviewedByUserId = approverId;
        ReviewerComment = comment;
        ReviewedAtUtc = DateTime.UtcNow;
        AddDomainEvent(new LeaveRequestRejectedEvent(Id, UserId, approverId, LeaveDate, comment));
    }

    public void Cancel()
    {
        if (Status != LeaveRequestStatus.Pending && Status != LeaveRequestStatus.Approved)
            throw new InvalidStateTransitionException(nameof(LeaveRequest), Status.ToString(), nameof(Cancel));

        Status = LeaveRequestStatus.Cancelled;
    }
}

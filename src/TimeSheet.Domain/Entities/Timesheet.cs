using TimeSheet.Domain.Common;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Events;
using TimeSheet.Domain.Exceptions;

namespace TimeSheet.Domain.Entities;

public class Timesheet : Entity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateOnly WorkDate { get; set; }
    public TimesheetStatus Status { get; set; } = TimesheetStatus.Draft;
    public string? SubmissionNotes { get; set; }
    public string? MismatchReason { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public User? ApprovedByUser { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public DateTime? RejectedAtUtc { get; set; }
    public string? ManagerComment { get; set; }

    public ICollection<TimesheetEntry> Entries { get; set; } = new List<TimesheetEntry>();
    public ICollection<ApprovalAction> ApprovalActions { get; set; } = new List<ApprovalAction>();

    /// <summary>Transitions the timesheet from Draft to Submitted.</summary>
    public void Submit()
    {
        if (Status != TimesheetStatus.Draft)
            throw new InvalidStateTransitionException(nameof(Timesheet), Status.ToString(), nameof(Submit));

        Status = TimesheetStatus.Submitted;
        SubmittedAtUtc = DateTime.UtcNow;
        AddDomainEvent(new TimesheetSubmittedEvent(Id, UserId, WorkDate));
    }

    /// <summary>Transitions the timesheet from Submitted to Approved.</summary>
    public void Approve(Guid approverId)
    {
        if (Status != TimesheetStatus.Submitted)
            throw new InvalidStateTransitionException(nameof(Timesheet), Status.ToString(), nameof(Approve));

        Status = TimesheetStatus.Approved;
        ApprovedByUserId = approverId;
        ApprovedAtUtc = DateTime.UtcNow;
        AddDomainEvent(new TimesheetApprovedEvent(Id, UserId, approverId, WorkDate));
    }

    /// <summary>Transitions the timesheet from Submitted to Rejected.</summary>
    public void Reject(Guid approverId, string comment)
    {
        if (Status != TimesheetStatus.Submitted)
            throw new InvalidStateTransitionException(nameof(Timesheet), Status.ToString(), nameof(Reject));

        Status = TimesheetStatus.Rejected;
        ManagerComment = comment;
        RejectedAtUtc = DateTime.UtcNow;
        AddDomainEvent(new TimesheetRejectedEvent(Id, UserId, approverId, WorkDate, comment));
    }

    /// <summary>Pushes back a Submitted timesheet to Draft for re-editing.</summary>
    public void PushBack(Guid approverId, string comment)
    {
        if (Status != TimesheetStatus.Submitted)
            throw new InvalidStateTransitionException(nameof(Timesheet), Status.ToString(), nameof(PushBack));

        Status = TimesheetStatus.Draft;
        ManagerComment = comment;
        AddDomainEvent(new TimesheetPushedBackEvent(Id, UserId, approverId, WorkDate, comment));
    }
}

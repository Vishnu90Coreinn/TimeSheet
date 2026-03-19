using TimeSheet.Domain.Common;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Events;
using TimeSheet.Domain.Exceptions;

namespace TimeSheet.Domain.Entities;

public class WorkSession : Entity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateOnly WorkDate { get; set; }
    public DateTime CheckInAtUtc { get; set; }
    public DateTime? CheckOutAtUtc { get; set; }
    public WorkSessionStatus Status { get; set; } = WorkSessionStatus.Active;
    public bool HasAttendanceException { get; set; }
    public ICollection<BreakEntry> Breaks { get; set; } = new List<BreakEntry>();

    public void CheckOut(DateTime checkOutAtUtc)
    {
        if (Status != WorkSessionStatus.Active)
            throw new InvalidStateTransitionException(nameof(WorkSession), Status.ToString(), nameof(CheckOut));

        CheckOutAtUtc = checkOutAtUtc;
        Status = WorkSessionStatus.Completed;
        AddDomainEvent(new WorkSessionCheckedOutEvent(Id, UserId, checkOutAtUtc));
    }

    public void AddBreak(DateTime startAtUtc)
    {
        if (Status != WorkSessionStatus.Active)
            throw new DomainException("Cannot add a break to a work session that is not active.");

        var openBreak = Breaks.FirstOrDefault(b => b.EndAtUtc == null);
        if (openBreak != null)
            throw new DomainException("Cannot add a new break while there is already an open break.");

        Breaks.Add(new BreakEntry
        {
            WorkSessionId = Id,
            StartAtUtc = startAtUtc
        });
    }

    public void EndBreak(DateTime endAtUtc)
    {
        var openBreak = Breaks.FirstOrDefault(b => b.EndAtUtc == null);
        if (openBreak == null)
            throw new DomainException("No open break found to end.");

        openBreak.EndAtUtc = endAtUtc;
    }
}

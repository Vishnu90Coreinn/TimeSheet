using FluentAssertions;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Events;
using TimeSheet.Domain.Exceptions;

namespace TimeSheet.Domain.Tests;

public class LeaveRequestTests
{
    private static LeaveRequest CreatePending() =>
        new()
        {
            UserId = Guid.NewGuid(),
            LeaveTypeId = Guid.NewGuid(),
            LeaveDate = DateOnly.FromDateTime(DateTime.Today)
        };

    // ── Approve ───────────────────────────────────────────────────────────────

    [Fact]
    public void Approve_FromPending_SetsStatusApprovedAndFiresEvent()
    {
        var lr = CreatePending();
        var approverId = Guid.NewGuid();

        lr.Approve(approverId);

        lr.Status.Should().Be(LeaveRequestStatus.Approved);
        lr.ReviewedByUserId.Should().Be(approverId);
        lr.ReviewedAtUtc.Should().NotBeNull();
        lr.DomainEvents.OfType<LeaveRequestApprovedEvent>().Should().ContainSingle();
    }

    [Fact]
    public void Approve_FromApproved_ThrowsInvalidStateTransition()
    {
        var lr = CreatePending();
        lr.Approve(Guid.NewGuid());

        Action act = () => lr.Approve(Guid.NewGuid());

        act.Should().Throw<InvalidStateTransitionException>();
    }

    // ── Reject ────────────────────────────────────────────────────────────────

    [Fact]
    public void Reject_FromPending_SetsStatusRejectedAndFiresEvent()
    {
        var lr = CreatePending();
        var approverId = Guid.NewGuid();

        lr.Reject(approverId, "Insufficient balance");

        lr.Status.Should().Be(LeaveRequestStatus.Rejected);
        lr.ReviewedByUserId.Should().Be(approverId);
        lr.ReviewerComment.Should().Be("Insufficient balance");
        lr.ReviewedAtUtc.Should().NotBeNull();
        lr.DomainEvents.OfType<LeaveRequestRejectedEvent>().Should().ContainSingle();
    }

    [Fact]
    public void Reject_FromApproved_ThrowsInvalidStateTransition()
    {
        var lr = CreatePending();
        lr.Approve(Guid.NewGuid());

        Action act = () => lr.Reject(Guid.NewGuid(), "comment");

        act.Should().Throw<InvalidStateTransitionException>();
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    [Fact]
    public void Cancel_FromPending_SetsStatusCancelled()
    {
        var lr = CreatePending();

        lr.Cancel();

        lr.Status.Should().Be(LeaveRequestStatus.Cancelled);
    }

    [Fact]
    public void Cancel_FromApproved_SetsStatusCancelled()
    {
        var lr = CreatePending();
        lr.Approve(Guid.NewGuid());

        lr.Cancel();

        lr.Status.Should().Be(LeaveRequestStatus.Cancelled);
    }

    [Fact]
    public void Cancel_FromRejected_ThrowsInvalidStateTransition()
    {
        var lr = CreatePending();
        lr.Reject(Guid.NewGuid(), "Not approved");

        Action act = () => lr.Cancel();

        act.Should().Throw<InvalidStateTransitionException>();
    }
}

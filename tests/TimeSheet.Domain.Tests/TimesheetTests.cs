using FluentAssertions;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Events;
using TimeSheet.Domain.Exceptions;

namespace TimeSheet.Domain.Tests;

public class TimesheetTests
{
    private static Timesheet CreateDraft() =>
        new() { UserId = Guid.NewGuid(), WorkDate = DateOnly.FromDateTime(DateTime.Today) };

    // ── Submit ────────────────────────────────────────────────────────────────

    [Fact]
    public void Submit_FromDraft_SetsStatusSubmittedAndFiresEvent()
    {
        var ts = CreateDraft();

        ts.Submit();

        ts.Status.Should().Be(TimesheetStatus.Submitted);
        ts.SubmittedAtUtc.Should().NotBeNull();
        ts.DomainEvents.OfType<TimesheetSubmittedEvent>().Should().ContainSingle();
    }

    [Fact]
    public void Submit_FromSubmitted_ThrowsInvalidStateTransition()
    {
        var ts = CreateDraft();
        ts.Submit();

        Action act = () => ts.Submit();

        act.Should().Throw<InvalidStateTransitionException>();
    }

    [Fact]
    public void Submit_FromApproved_ThrowsInvalidStateTransition()
    {
        var ts = CreateDraft();
        ts.Status = TimesheetStatus.Approved;

        Action act = () => ts.Submit();

        act.Should().Throw<InvalidStateTransitionException>();
    }

    // ── Approve ───────────────────────────────────────────────────────────────

    [Fact]
    public void Approve_FromSubmitted_SetsStatusApprovedAndFiresEvent()
    {
        var ts = CreateDraft();
        ts.Submit();
        var approverId = Guid.NewGuid();

        ts.Approve(approverId);

        ts.Status.Should().Be(TimesheetStatus.Approved);
        ts.ApprovedByUserId.Should().Be(approverId);
        ts.ApprovedAtUtc.Should().NotBeNull();
        ts.DomainEvents.OfType<TimesheetApprovedEvent>().Should().ContainSingle();
    }

    [Fact]
    public void Approve_FromDraft_ThrowsInvalidStateTransition()
    {
        var ts = CreateDraft();

        Action act = () => ts.Approve(Guid.NewGuid());

        act.Should().Throw<InvalidStateTransitionException>();
    }

    // ── Reject ────────────────────────────────────────────────────────────────

    [Fact]
    public void Reject_FromSubmitted_SetsStatusRejectedAndFiresEvent()
    {
        var ts = CreateDraft();
        ts.Submit();
        var approverId = Guid.NewGuid();

        ts.Reject(approverId, "Missing entries");

        ts.Status.Should().Be(TimesheetStatus.Rejected);
        ts.ManagerComment.Should().Be("Missing entries");
        ts.RejectedAtUtc.Should().NotBeNull();
        ts.DomainEvents.OfType<TimesheetRejectedEvent>().Should().ContainSingle();
    }

    [Fact]
    public void Reject_FromDraft_ThrowsInvalidStateTransition()
    {
        var ts = CreateDraft();

        Action act = () => ts.Reject(Guid.NewGuid(), "comment");

        act.Should().Throw<InvalidStateTransitionException>();
    }

    // ── PushBack ──────────────────────────────────────────────────────────────

    [Fact]
    public void PushBack_FromSubmitted_SetsStatusDraftAndFiresEvent()
    {
        var ts = CreateDraft();
        ts.Submit();
        var approverId = Guid.NewGuid();

        ts.PushBack(approverId, "Needs more detail");

        ts.Status.Should().Be(TimesheetStatus.Draft);
        ts.ManagerComment.Should().Be("Needs more detail");
        ts.DomainEvents.OfType<TimesheetPushedBackEvent>().Should().ContainSingle();
    }

    [Fact]
    public void PushBack_FromDraft_ThrowsInvalidStateTransition()
    {
        var ts = CreateDraft();

        Action act = () => ts.PushBack(Guid.NewGuid(), "comment");

        act.Should().Throw<InvalidStateTransitionException>();
    }
}

using FluentAssertions;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Events;
using TimeSheet.Domain.Exceptions;

namespace TimeSheet.Domain.Tests;

public class WorkSessionTests
{
    private static WorkSession CreateActive() =>
        new()
        {
            UserId = Guid.NewGuid(),
            WorkDate = DateOnly.FromDateTime(DateTime.Today),
            CheckInAtUtc = DateTime.UtcNow
        };

    // ── CheckOut ──────────────────────────────────────────────────────────────

    [Fact]
    public void CheckOut_FromActive_SetsStatusCompletedAndFiresEvent()
    {
        var ws = CreateActive();
        var checkOutTime = DateTime.UtcNow.AddHours(8);

        ws.CheckOut(checkOutTime);

        ws.Status.Should().Be(WorkSessionStatus.Completed);
        ws.CheckOutAtUtc.Should().Be(checkOutTime);
        ws.DomainEvents.OfType<WorkSessionCheckedOutEvent>().Should().ContainSingle();
    }

    [Fact]
    public void CheckOut_FromCompleted_ThrowsInvalidStateTransition()
    {
        var ws = CreateActive();
        ws.CheckOut(DateTime.UtcNow.AddHours(8));

        Action act = () => ws.CheckOut(DateTime.UtcNow.AddHours(9));

        act.Should().Throw<InvalidStateTransitionException>();
    }

    // ── AddBreak ──────────────────────────────────────────────────────────────

    [Fact]
    public void AddBreak_WhenActive_AddsBreakEntry()
    {
        var ws = CreateActive();
        var breakStart = DateTime.UtcNow.AddHours(2);

        ws.AddBreak(breakStart);

        ws.Breaks.Should().ContainSingle();
        ws.Breaks.Single().StartAtUtc.Should().Be(breakStart);
        ws.Breaks.Single().EndAtUtc.Should().BeNull();
    }

    [Fact]
    public void AddBreak_WhenOpenBreakAlreadyExists_ThrowsDomainException()
    {
        var ws = CreateActive();
        ws.AddBreak(DateTime.UtcNow.AddHours(2));

        Action act = () => ws.AddBreak(DateTime.UtcNow.AddHours(3));

        act.Should().Throw<DomainException>()
            .WithMessage("*open break*");
    }

    // ── EndBreak ──────────────────────────────────────────────────────────────

    [Fact]
    public void EndBreak_WhenOpenBreakExists_ClosesBreak()
    {
        var ws = CreateActive();
        var breakStart = DateTime.UtcNow.AddHours(2);
        var breakEnd = DateTime.UtcNow.AddHours(2).AddMinutes(30);
        ws.AddBreak(breakStart);

        ws.EndBreak(breakEnd);

        ws.Breaks.Single().EndAtUtc.Should().Be(breakEnd);
    }

    [Fact]
    public void EndBreak_WhenNoOpenBreak_ThrowsDomainException()
    {
        var ws = CreateActive();

        Action act = () => ws.EndBreak(DateTime.UtcNow.AddHours(2));

        act.Should().Throw<DomainException>()
            .WithMessage("*No open break*");
    }
}

using TimeSheet.Api.Models;
using TimeSheet.Api.Services;
using Xunit;

namespace TimeSheet.Api.Tests;

public class AttendanceCalculationServiceTests
{
    private readonly AttendanceCalculationService _service = new();

    [Fact]
    public void Calculates_StandardDay_09To18_WithLunchAndBreaks()
    {
        var workDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = workDate.ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc);
        var end = workDate.ToDateTime(new TimeOnly(18, 0), DateTimeKind.Utc);

        var session = new WorkSession
        {
            CheckInAtUtc = start,
            CheckOutAtUtc = end,
            WorkDate = workDate,
            Breaks =
            [
                new BreakEntry { StartAtUtc = start.AddHours(3), EndAtUtc = start.AddHours(3).AddMinutes(15), DurationMinutes = 15 },
                new BreakEntry { StartAtUtc = start.AddHours(6), EndAtUtc = start.AddHours(6).AddMinutes(15), DurationMinutes = 15 }
            ]
        };

        var totals = _service.Calculate([session], new WorkPolicy { FixedLunchDeductionMinutes = 45, LowGrossThresholdMinutes = 300, SkipLunchDeductionForLowGross = true }, DateTime.UtcNow);

        Assert.Equal(540, totals.GrossMinutes);
        Assert.Equal(30, totals.BreakMinutes);
        Assert.Equal(45, totals.FixedLunchMinutes);
        Assert.Equal(465, totals.NetMinutes);
    }

    [Fact]
    public void Calculates_LongDay_09To21_WithFixedLunchAndNoBreak()
    {
        var workDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = workDate.ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc);
        var end = workDate.ToDateTime(new TimeOnly(21, 0), DateTimeKind.Utc);

        var session = new WorkSession { CheckInAtUtc = start, CheckOutAtUtc = end, WorkDate = workDate };
        var totals = _service.Calculate([session], new WorkPolicy { FixedLunchDeductionMinutes = 45 }, DateTime.UtcNow);

        Assert.Equal(720, totals.GrossMinutes);
        Assert.Equal(45, totals.FixedLunchMinutes);
        Assert.Equal(0, totals.BreakMinutes);
        Assert.Equal(675, totals.NetMinutes);
    }


    [Fact]
    public void IgnoresMissingCheckoutSessionWithoutCheckoutTimestamp()
    {
        var workDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        var start = workDate.ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc);

        var staleSession = new WorkSession
        {
            CheckInAtUtc = start,
            CheckOutAtUtc = null,
            WorkDate = workDate,
            Status = WorkSessionStatus.MissingCheckout
        };

        var totals = _service.Calculate([staleSession], new WorkPolicy { FixedLunchDeductionMinutes = 45 }, DateTime.UtcNow);

        Assert.Equal(0, totals.GrossMinutes);
        Assert.Equal(0, totals.FixedLunchMinutes);
        Assert.Equal(0, totals.BreakMinutes);
        Assert.Equal(0, totals.NetMinutes);
    }

    [Fact]
    public void SkipsLunch_WhenGrossBelowThreshold()
    {
        var workDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = workDate.ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc);
        var end = workDate.ToDateTime(new TimeOnly(12, 0), DateTimeKind.Utc);

        var session = new WorkSession { CheckInAtUtc = start, CheckOutAtUtc = end, WorkDate = workDate };
        var totals = _service.Calculate([session], new WorkPolicy { FixedLunchDeductionMinutes = 45, LowGrossThresholdMinutes = 300, SkipLunchDeductionForLowGross = true }, DateTime.UtcNow);

        Assert.Equal(180, totals.GrossMinutes);
        Assert.Equal(0, totals.FixedLunchMinutes);
        Assert.Equal(180, totals.NetMinutes);
    }
}

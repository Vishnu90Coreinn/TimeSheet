using TimeSheet.Api.Models;

namespace TimeSheet.Api.Services;

public interface IAttendanceCalculationService
{
    AttendanceTotals Calculate(IReadOnlyCollection<WorkSession> sessions, WorkPolicy? policy, DateTime nowUtc);
}

public record AttendanceTotals(int GrossMinutes, int FixedLunchMinutes, int BreakMinutes, int NetMinutes);

public class AttendanceCalculationService : IAttendanceCalculationService
{
    public AttendanceTotals Calculate(IReadOnlyCollection<WorkSession> sessions, WorkPolicy? policy, DateTime nowUtc)
    {
        var grossMinutes = sessions.Sum(s =>
        {
            var end = s.CheckOutAtUtc ?? nowUtc;
            var minutes = (int)Math.Max(0, (end - s.CheckInAtUtc).TotalMinutes);
            return minutes;
        });

        var breakMinutes = sessions.SelectMany(s => s.Breaks).Sum(b =>
        {
            var end = b.EndAtUtc ?? nowUtc;
            return (int)Math.Max(0, (end - b.StartAtUtc).TotalMinutes);
        });

        var lunchDeduction = policy?.FixedLunchDeductionMinutes ?? 45;
        var lowGrossThreshold = policy?.LowGrossThresholdMinutes ?? 300;
        var skipLunchForLowGross = policy?.SkipLunchDeductionForLowGross ?? true;

        var fixedLunch = skipLunchForLowGross && grossMinutes < lowGrossThreshold
            ? 0
            : Math.Clamp(lunchDeduction, 0, grossMinutes);

        var net = Math.Max(0, grossMinutes - fixedLunch - breakMinutes);
        return new AttendanceTotals(grossMinutes, fixedLunch, breakMinutes, net);
    }
}

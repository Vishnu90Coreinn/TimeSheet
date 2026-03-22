namespace TimeSheet.Domain.ValueObjects;

/// <summary>Represents work hours for a day, bounded by a work policy's expected minutes.</summary>
public sealed record WorkHours
{
    public int NetMinutes { get; }
    public int ExpectedMinutes { get; }

    public WorkHours(int netMinutes, int expectedMinutes)
    {
        if (netMinutes < 0)
            throw new ArgumentException("Net minutes cannot be negative.", nameof(netMinutes));
        if (expectedMinutes <= 0)
            throw new ArgumentException("Expected minutes must be positive.", nameof(expectedMinutes));

        NetMinutes = netMinutes;
        ExpectedMinutes = expectedMinutes;
    }

    public double CompliancePercent => ExpectedMinutes > 0
        ? Math.Min(100.0, Math.Round((double)NetMinutes / ExpectedMinutes * 100, 1))
        : 0;

    public bool MeetsExpectation => NetMinutes >= ExpectedMinutes;
    public int DeficitMinutes => Math.Max(0, ExpectedMinutes - NetMinutes);

    public override string ToString() => $"{NetMinutes}min / {ExpectedMinutes}min ({CompliancePercent}%)";
}

namespace TimeSheet.Domain.ValueObjects;

/// <summary>Represents a non-negative duration in minutes.</summary>
public sealed record Duration
{
    public int TotalMinutes { get; }

    public Duration(int totalMinutes)
    {
        if (totalMinutes < 0)
            throw new ArgumentException("Duration cannot be negative.", nameof(totalMinutes));
        TotalMinutes = totalMinutes;
    }

    public static Duration Zero => new(0);
    public static Duration FromHours(double hours) => new((int)(hours * 60));

    public int Hours => TotalMinutes / 60;
    public int Minutes => TotalMinutes % 60;
    public bool IsZero => TotalMinutes == 0;

    public Duration Add(Duration other) => new(TotalMinutes + other.TotalMinutes);
    public Duration Subtract(Duration other) => new(Math.Max(0, TotalMinutes - other.TotalMinutes));

    public override string ToString() => $"{Hours}h {Minutes}m";
}

namespace TimeSheet.Domain.ValueObjects;

/// <summary>Represents an inclusive date range with validation.</summary>
public sealed record DateRange
{
    public DateOnly Start { get; }
    public DateOnly End { get; }

    public DateRange(DateOnly start, DateOnly end)
    {
        if (end < start)
            throw new ArgumentException($"End date '{end}' cannot be before start date '{start}'.");
        Start = start;
        End = end;
    }

    public int TotalDays => End.DayNumber - Start.DayNumber + 1;
    public bool Contains(DateOnly date) => date >= Start && date <= End;
    public bool Overlaps(DateRange other) => Start <= other.End && End >= other.Start;

    public override string ToString() => $"{Start:yyyy-MM-dd} to {End:yyyy-MM-dd}";
}

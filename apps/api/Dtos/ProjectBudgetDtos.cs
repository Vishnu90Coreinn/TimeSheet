namespace TimeSheet.Api.Dtos;

public record ProjectBudgetHealthItem(
    Guid Id,
    string Name,
    string Code,
    int BudgetedHours,
    double LoggedHours,
    double PctUsed,
    string Status
);

public record WeeklyBurnEntry(string WeekStart, double Hours);

public record ProjectBudgetSummaryResponse(
    Guid Id,
    string Name,
    int BudgetedHours,
    double LoggedHours,
    double RemainingHours,
    double BurnRateHoursPerWeek,
    double? ProjectedWeeksRemaining,
    IReadOnlyList<WeeklyBurnEntry> WeeklyBreakdown
);

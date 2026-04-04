namespace TimeSheet.Application.ProjectBudget.Queries;

public record ProjectBudgetHealthItemResult(
    Guid Id,
    string Name,
    string Code,
    int BudgetedHours,
    double LoggedHours,
    double PctUsed,
    string Status);

public record WeeklyBurnEntryResult(string WeekStart, double Hours);

public record ProjectBudgetSummaryResult(
    Guid Id,
    string Name,
    int BudgetedHours,
    double LoggedHours,
    double RemainingHours,
    double BurnRateHoursPerWeek,
    double? ProjectedWeeksRemaining,
    IReadOnlyList<WeeklyBurnEntryResult> WeeklyBreakdown);

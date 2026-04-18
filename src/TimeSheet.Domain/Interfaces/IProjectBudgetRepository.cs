namespace TimeSheet.Domain.Interfaces;

public interface IProjectBudgetRepository
{
    Task<IReadOnlyList<ProjectBudgetHealthRow>> GetBudgetHealthAsync(CancellationToken ct = default);
    Task<ProjectBudgetSummaryRow?> GetBudgetSummaryAsync(Guid projectId, CancellationToken ct = default);
}

public record ProjectBudgetHealthRow(
    Guid Id,
    string Name,
    string Code,
    int BudgetedHours,
    double LoggedHours,
    double PctUsed,
    string Status);

public record WeeklyBurnRow(string WeekStart, double Hours);

public record ProjectBudgetSummaryRow(
    Guid Id,
    string Name,
    int BudgetedHours,
    double LoggedHours,
    double RemainingHours,
    double BurnRateHoursPerWeek,
    double? ProjectedWeeksRemaining,
    IReadOnlyList<WeeklyBurnRow> WeeklyBreakdown);

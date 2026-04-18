namespace TimeSheet.Api.Dtos;

public record CapacityWeekCell(
    string WeekStart,
    double LoggedHours,
    int Pct
);

public record CapacityTeamRow(
    Guid UserId,
    string Username,
    string DisplayName,
    double AvailableHoursPerWeek,
    IReadOnlyList<CapacityWeekCell> Weeks
);

public record CapacityTeamResponse(
    IReadOnlyList<string> WeekStarts,
    IReadOnlyList<CapacityTeamRow> Rows
);

public record CapacityProjectContribution(
    Guid UserId,
    string Username,
    double LoggedHours
);

public record CapacityProjectItem(
    Guid ProjectId,
    string ProjectName,
    double BudgetedHours,
    double LoggedHours,
    int Pct,
    IReadOnlyList<CapacityProjectContribution> Contributions
);

public record OverallocatedUser(
    Guid UserId,
    string Username,
    string? DisplayName,
    double AvailableHoursPerWeek,
    double LoggedHours,
    int Pct
);

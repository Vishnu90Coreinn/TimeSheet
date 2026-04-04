namespace TimeSheet.Application.TimesheetExports.Queries;

public record TimesheetExportUserResult(Guid Id, string DisplayName, string Username);

public record TimesheetExportRowResult(
    DateOnly Date,
    string Employee,
    string Status,
    string Project,
    string TaskCategory,
    int Minutes,
    string Notes);

public record TimesheetExportDataResult(
    IReadOnlyList<TimesheetExportRowResult> Rows,
    string FileName);

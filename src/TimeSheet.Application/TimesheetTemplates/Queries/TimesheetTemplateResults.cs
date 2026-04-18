namespace TimeSheet.Application.TimesheetTemplates.Queries;

public record TemplateEntryItemResult(Guid ProjectId, Guid CategoryId, int Minutes, string? Note);

public record TimesheetTemplateResult(
    Guid Id,
    string Name,
    DateTime CreatedAtUtc,
    IReadOnlyList<TemplateEntryItemResult> Entries);

public enum TemplateApplyOutcomeType
{
    Success,
    TemplateNotFound,
    TimesheetLocked
}

public record TemplateApplyOutcome(TemplateApplyOutcomeType Outcome, int EntriesCreated, int EntriesSkipped, Guid? TimesheetId);

using TimeSheet.Application.TimesheetTemplates.Queries;

namespace TimeSheet.Application.Common.Interfaces;

public interface ITimesheetTemplateService
{
    Task<IReadOnlyList<TimesheetTemplateResult>> GetAllAsync(Guid userId, CancellationToken ct = default);
    Task<TimesheetTemplateResult> CreateAsync(Guid userId, string name, IReadOnlyList<TemplateEntryItemResult> entries, CancellationToken ct = default);
    Task<TimesheetTemplateResult?> UpdateAsync(Guid userId, Guid templateId, string name, IReadOnlyList<TemplateEntryItemResult> entries, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid userId, Guid templateId, CancellationToken ct = default);
    Task<TemplateApplyOutcome> ApplyAsync(Guid userId, Guid templateId, DateOnly workDate, CancellationToken ct = default);
}

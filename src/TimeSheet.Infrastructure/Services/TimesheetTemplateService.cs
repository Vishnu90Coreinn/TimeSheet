using System.Text.Json;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.TimesheetTemplates.Queries;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class TimesheetTemplateService(
    ITimesheetTemplateRepository repository,
    ITimerRepository timerRepository,
    IUnitOfWork unitOfWork) : ITimesheetTemplateService
{
    public async Task<IReadOnlyList<TimesheetTemplateResult>> GetAllAsync(Guid userId, CancellationToken ct = default)
        => (await repository.GetByUserAsync(userId, ct)).Select(template => Map(template)).ToList();

    public async Task<TimesheetTemplateResult> CreateAsync(Guid userId, string name, IReadOnlyList<TemplateEntryItemResult> entries, CancellationToken ct = default)
    {
        var template = new TimesheetTemplate
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = name,
            EntriesJson = JsonSerializer.Serialize(entries),
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        repository.Add(template);
        await unitOfWork.SaveChangesAsync(ct);
        return Map(template, entries);
    }

    public async Task<TimesheetTemplateResult?> UpdateAsync(Guid userId, Guid templateId, string name, IReadOnlyList<TemplateEntryItemResult> entries, CancellationToken ct = default)
    {
        var template = await repository.GetByIdForUserAsync(templateId, userId, false, ct);
        if (template is null) return null;
        template.Name = name;
        template.EntriesJson = JsonSerializer.Serialize(entries);
        template.UpdatedAtUtc = DateTime.UtcNow;
        await unitOfWork.SaveChangesAsync(ct);
        return Map(template, entries);
    }

    public async Task<bool> DeleteAsync(Guid userId, Guid templateId, CancellationToken ct = default)
    {
        var template = await repository.GetByIdForUserAsync(templateId, userId, false, ct);
        if (template is null) return false;
        repository.Remove(template);
        await unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<TemplateApplyOutcome> ApplyAsync(Guid userId, Guid templateId, DateOnly workDate, CancellationToken ct = default)
    {
        var template = await repository.GetByIdForUserAsync(templateId, userId, true, ct);
        if (template is null) return new TemplateApplyOutcome(TemplateApplyOutcomeType.TemplateNotFound, 0, 0, null);
        var entries = JsonSerializer.Deserialize<List<TemplateEntryItemResult>>(template.EntriesJson) ?? [];
        var timesheet = await timerRepository.GetTimesheetByUserAndDateAsync(userId, workDate, ct);
        if (timesheet is null)
        {
            timesheet = new Timesheet { UserId = userId, WorkDate = workDate, Status = TimesheetStatus.Draft };
            timerRepository.AddTimesheet(timesheet);
        }
        else if (timesheet.Status != TimesheetStatus.Draft)
        {
            return new TemplateApplyOutcome(TemplateApplyOutcomeType.TimesheetLocked, 0, 0, null);
        }

        var created = 0;
        var skipped = 0;
        foreach (var entry in entries)
        {
            var duplicate = timesheet.Entries.Any(e => e.ProjectId == entry.ProjectId && e.TaskCategoryId == entry.CategoryId && e.Minutes == entry.Minutes);
            if (duplicate)
            {
                skipped++;
                continue;
            }

            timerRepository.AddEntry(new TimesheetEntry
            {
                Id = Guid.NewGuid(),
                TimesheetId = timesheet.Id,
                ProjectId = entry.ProjectId,
                TaskCategoryId = entry.CategoryId,
                Minutes = entry.Minutes,
                Notes = entry.Note
            });
            created++;
        }

        await unitOfWork.SaveChangesAsync(ct);
        return new TemplateApplyOutcome(TemplateApplyOutcomeType.Success, created, skipped, timesheet.Id);
    }

    private static TimesheetTemplateResult Map(TimesheetTemplate template, IReadOnlyList<TemplateEntryItemResult>? entries = null)
        => new(template.Id, template.Name, template.CreatedAtUtc, entries ?? (JsonSerializer.Deserialize<List<TemplateEntryItemResult>>(template.EntriesJson) ?? []));
}

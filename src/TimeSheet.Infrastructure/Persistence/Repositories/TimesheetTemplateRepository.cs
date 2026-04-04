using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class TimesheetTemplateRepository(TimeSheetDbContext context) : ITimesheetTemplateRepository
{
    public async Task<IReadOnlyList<TimesheetTemplate>> GetByUserAsync(Guid userId, CancellationToken ct = default)
        => await context.TimesheetTemplates.AsNoTracking()
            .Where(t => t.UserId == userId)
            .OrderBy(t => t.Name)
            .ToListAsync(ct);

    public async Task<TimesheetTemplate?> GetByIdForUserAsync(Guid templateId, Guid userId, bool asNoTracking = false, CancellationToken ct = default)
    {
        var query = context.TimesheetTemplates.Where(t => t.Id == templateId && t.UserId == userId);
        if (asNoTracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct);
    }

    public void Add(TimesheetTemplate template) => context.TimesheetTemplates.Add(template);
    public void Remove(TimesheetTemplate template) => context.TimesheetTemplates.Remove(template);
}

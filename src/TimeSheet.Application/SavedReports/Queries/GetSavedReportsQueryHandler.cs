using System.Text.Json;
using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.SavedReports.Queries;

public class GetSavedReportsQueryHandler(ISavedReportRepository repo, ICurrentUserService currentUser)
    : IRequestHandler<GetSavedReportsQuery, Result<List<SavedReportDto>>>
{
    public async Task<Result<List<SavedReportDto>>> Handle(GetSavedReportsQuery request, CancellationToken cancellationToken)
    {
        var reports = await repo.GetByUserAsync(currentUser.UserId, cancellationToken);
        var result = reports.Select(r => new SavedReportDto(
            r.Id, r.Name, r.ReportKey, r.FiltersJson,
            r.ScheduleType.ToString(),
            r.ScheduleDayOfWeek,
            r.ScheduleHour,
            JsonSerializer.Deserialize<List<string>>(r.RecipientEmailsJson) ?? [],
            r.LastRunAt,
            r.CreatedAtUtc)).ToList();
        return Result<List<SavedReportDto>>.Success(result);
    }
}

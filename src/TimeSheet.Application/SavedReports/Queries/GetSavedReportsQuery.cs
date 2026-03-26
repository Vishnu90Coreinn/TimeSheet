using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.SavedReports.Queries;

public record GetSavedReportsQuery : IRequest<Result<List<SavedReportDto>>>;

public record SavedReportDto(
    Guid Id,
    string Name,
    string ReportKey,
    string FiltersJson,
    string ScheduleType,
    DayOfWeek? ScheduleDayOfWeek,
    int ScheduleHour,
    List<string> RecipientEmails,
    DateTime? LastRunAt,
    DateTime CreatedAtUtc);

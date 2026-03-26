using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.SavedReports.Queries;

namespace TimeSheet.Application.SavedReports.Commands;

public record CreateSavedReportCommand(
    string Name,
    string ReportKey,
    string FiltersJson,
    string ScheduleType,
    DayOfWeek? ScheduleDayOfWeek,
    int ScheduleHour,
    List<string> RecipientEmails)
    : IRequest<Result<SavedReportDto>>;

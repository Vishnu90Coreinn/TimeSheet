using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.SavedReports.Queries;

namespace TimeSheet.Application.SavedReports.Commands;

public record UpdateSavedReportCommand(
    Guid Id,
    string Name,
    string FiltersJson,
    string ScheduleType,
    DayOfWeek? ScheduleDayOfWeek,
    int ScheduleHour,
    List<string> RecipientEmails)
    : IRequest<Result<SavedReportDto>>;

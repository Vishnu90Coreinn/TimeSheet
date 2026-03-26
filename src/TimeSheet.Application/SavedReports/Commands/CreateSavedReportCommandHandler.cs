using System.Text.Json;
using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.SavedReports.Queries;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.SavedReports.Commands;

public class CreateSavedReportCommandHandler(
    ISavedReportRepository repo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider)
    : IRequestHandler<CreateSavedReportCommand, Result<SavedReportDto>>
{
    public async Task<Result<SavedReportDto>> Handle(CreateSavedReportCommand request, CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<ScheduleType>(request.ScheduleType, true, out var scheduleType))
            return Result<SavedReportDto>.ValidationFailure("Invalid schedule type.");

        var report = new SavedReport
        {
            UserId = currentUser.UserId,
            Name = request.Name.Trim(),
            ReportKey = request.ReportKey,
            FiltersJson = request.FiltersJson,
            ScheduleType = scheduleType,
            ScheduleDayOfWeek = request.ScheduleDayOfWeek,
            ScheduleHour = request.ScheduleHour,
            RecipientEmailsJson = JsonSerializer.Serialize(request.RecipientEmails),
            CreatedAtUtc = dateTimeProvider.UtcNow
        };

        repo.Add(report);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<SavedReportDto>.Success(new SavedReportDto(
            report.Id, report.Name, report.ReportKey, report.FiltersJson,
            report.ScheduleType.ToString(), report.ScheduleDayOfWeek,
            report.ScheduleHour, request.RecipientEmails,
            report.LastRunAt, report.CreatedAtUtc));
    }
}

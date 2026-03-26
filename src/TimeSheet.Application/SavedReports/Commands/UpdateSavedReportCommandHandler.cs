using System.Text.Json;
using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.SavedReports.Queries;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.SavedReports.Commands;

public class UpdateSavedReportCommandHandler(
    ISavedReportRepository repo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser)
    : IRequestHandler<UpdateSavedReportCommand, Result<SavedReportDto>>
{
    public async Task<Result<SavedReportDto>> Handle(UpdateSavedReportCommand request, CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<ScheduleType>(request.ScheduleType, true, out var scheduleType))
            return Result<SavedReportDto>.ValidationFailure("Invalid schedule type.");

        var report = await repo.GetByIdAsync(request.Id, cancellationToken);
        if (report is null) return Result<SavedReportDto>.NotFound("Saved report not found.");
        if (report.UserId != currentUser.UserId && !currentUser.IsAdmin)
            return Result<SavedReportDto>.Forbidden("You cannot edit this report.");

        report.Name = request.Name.Trim();
        report.FiltersJson = request.FiltersJson;
        report.ScheduleType = scheduleType;
        report.ScheduleDayOfWeek = request.ScheduleDayOfWeek;
        report.ScheduleHour = request.ScheduleHour;
        report.RecipientEmailsJson = JsonSerializer.Serialize(request.RecipientEmails);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<SavedReportDto>.Success(new SavedReportDto(
            report.Id, report.Name, report.ReportKey, report.FiltersJson,
            report.ScheduleType.ToString(), report.ScheduleDayOfWeek,
            report.ScheduleHour, request.RecipientEmails,
            report.LastRunAt, report.CreatedAtUtc));
    }
}

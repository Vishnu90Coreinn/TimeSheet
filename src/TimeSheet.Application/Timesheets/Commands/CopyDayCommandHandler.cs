using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Timesheets.Commands;

public class CopyDayCommandHandler(
    ITimesheetRepository timesheetRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider,
    ITimesheetQueryService timesheetQuery)
    : IRequestHandler<CopyDayCommand, Result<TimesheetDayResult>>
{
    public async Task<Result<TimesheetDayResult>> Handle(CopyDayCommand request, CancellationToken ct)
    {
        var userId = currentUser.UserId;

        // Validate edit window on target date
        var today = dateTimeProvider.TodayUtc;
        if (request.TargetDate > today)
            return Result<TimesheetDayResult>.Failure("Future dates are not allowed for timesheet entry.");

        var backdateDays = await timesheetQuery.GetBackdateWindowDaysAsync(userId, ct);
        if (request.TargetDate < today.AddDays(-backdateDays))
            return Result<TimesheetDayResult>.Failure($"Timesheet editing window is limited to the last {backdateDays} day(s).");

        // Load source timesheet
        var source = await timesheetRepo.GetByUserAndDateAsync(userId, request.SourceDate, ct);
        if (source is null || source.Entries.Count == 0)
            return Result<TimesheetDayResult>.Failure("No entries found for source date.");

        // Get or create target (tracked)
        var target = await timesheetRepo.GetByUserAndDateAsync(userId, request.TargetDate, ct);
        if (target is null)
        {
            target = new Timesheet
            {
                UserId = userId,
                WorkDate = request.TargetDate,
                Status = TimesheetStatus.Draft
            };
            timesheetRepo.Add(target);
            await unitOfWork.SaveChangesAsync(ct);
        }

        if (target.Status != TimesheetStatus.Draft)
            return Result<TimesheetDayResult>.Conflict("Only draft timesheets can be edited.");

        // Remove existing entries on target
        foreach (var entry in target.Entries.ToList())
            timesheetRepo.RemoveEntry(entry);

        // Copy entries from source
        foreach (var e in source.Entries)
            target.Entries.Add(new TimesheetEntry
            {
                TimesheetId = target.Id,
                ProjectId = e.ProjectId,
                TaskCategoryId = e.TaskCategoryId,
                Minutes = e.Minutes,
                Notes = e.Notes
            });

        await unitOfWork.SaveChangesAsync(ct);

        var day = await timesheetQuery.GetDayAsync(userId, request.TargetDate, ct);
        return Result<TimesheetDayResult>.Success(day!);
    }
}

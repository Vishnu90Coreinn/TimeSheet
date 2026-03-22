using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Timesheets.Commands;

public class UpsertTimesheetEntryCommandHandler(
    ITimesheetQueryService timesheetQuery,
    ITimesheetRepository timesheetRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider,
    IAuditService auditService)
    : IRequestHandler<UpsertTimesheetEntryCommand, Result<TimesheetDayResult>>
{
    public async Task<Result<TimesheetDayResult>> Handle(
        UpsertTimesheetEntryCommand request,
        CancellationToken ct)
    {
        var userId = currentUser.UserId;

        // Validate edit window
        var today = dateTimeProvider.TodayUtc;
        if (request.WorkDate > today)
            return Result<TimesheetDayResult>.Failure("Future dates are not allowed.");

        var backdateDays = await timesheetQuery.GetBackdateWindowDaysAsync(userId, ct);
        if (request.WorkDate < today.AddDays(-backdateDays))
            return Result<TimesheetDayResult>.Failure($"Editing window is limited to {backdateDays} day(s).");

        // Validate minutes
        if (request.Minutes <= 0 || request.Minutes > 1440)
            return Result<TimesheetDayResult>.Failure("Minutes must be between 1 and 1440.");

        // Validate project
        var canWrite = await timesheetQuery.IsActiveProjectAsync(request.ProjectId, ct);
        if (!canWrite)
            return Result<TimesheetDayResult>.Failure("Only active projects can be used.");

        // Validate task category
        var hasCategory = await timesheetQuery.IsActiveTaskCategoryAsync(request.TaskCategoryId, ct);
        if (!hasCategory)
            return Result<TimesheetDayResult>.Failure("Only active task categories can be used.");

        // Get or create draft timesheet
        var timesheet = await timesheetRepo.GetByUserAndDateAsync(userId, request.WorkDate, ct);
        if (timesheet is null)
        {
            timesheet = new Timesheet
            {
                UserId = userId,
                WorkDate = request.WorkDate,
                Status = TimesheetStatus.Draft
            };
            timesheetRepo.Add(timesheet);
        }

        if (timesheet.Status != TimesheetStatus.Draft)
            return Result<TimesheetDayResult>.Conflict("Only draft timesheets can be edited.");

        // Upsert entry
        timesheet.Entries ??= new List<TimesheetEntry>();

        Guid entryId;
        if (request.EntryId is not null)
        {
            var existing = timesheet.Entries.FirstOrDefault(e => e.Id == request.EntryId.Value);
            if (existing is not null)
            {
                existing.ProjectId = request.ProjectId;
                existing.TaskCategoryId = request.TaskCategoryId;
                existing.Minutes = request.Minutes;
                existing.Notes = request.Notes;
                entryId = existing.Id;
            }
            else
            {
                var entry = new TimesheetEntry
                {
                    Id = Guid.NewGuid(),
                    TimesheetId = timesheet.Id,
                    ProjectId = request.ProjectId,
                    TaskCategoryId = request.TaskCategoryId,
                    Minutes = request.Minutes,
                    Notes = request.Notes
                };
                timesheetRepo.AddEntry(entry);
                entryId = entry.Id;
            }
        }
        else
        {
            var entry = new TimesheetEntry
            {
                Id = Guid.NewGuid(),
                TimesheetId = timesheet.Id,
                ProjectId = request.ProjectId,
                TaskCategoryId = request.TaskCategoryId,
                Minutes = request.Minutes,
                Notes = request.Notes
            };
            timesheetRepo.AddEntry(entry);
            entryId = entry.Id;
        }

        await auditService.WriteAsync(
            request.EntryId.HasValue ? "TimesheetEntryUpdated" : "TimesheetEntryCreated",
            "TimesheetEntry",
            entryId.ToString(),
            $"Entry for {request.WorkDate}",
            userId);

        await unitOfWork.SaveChangesAsync(ct);

        var day = await timesheetQuery.GetDayAsync(userId, request.WorkDate, ct);
        return Result<TimesheetDayResult>.Success(day!);
    }
}
